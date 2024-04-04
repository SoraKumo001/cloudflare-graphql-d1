import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '@pothos/plugin-prisma-utils';
import { PrismaClient, User } from '@prisma/client';
import { GraphQLScalarType, GraphQLSchema } from 'graphql';
import { createYoga } from 'graphql-yoga';
import PothosPrismaGeneratorPlugin from 'pothos-prisma-generator';
import { explorer } from './explorer';
import PrismaTypes from './generated/pothos-types';
import { parse, serialize } from 'cookie';
import { SignJWT, jwtVerify } from 'jose';
import { PrismaD1 } from '@prisma/adapter-d1';

/**
 * @type {Env}
 * @description Cloudflare Environment variables
 */
type Env = {
	DB: D1Database;
	SECRET: string;
};

/**
 * @type {Context}
 * @description Context for the GraphQL server
 */
type Context = {
	env: Env;
	request: Request;
	responseCookies: string[];
	setCookie: typeof serialize;
	cookies: { [key: string]: string };
	user?: User & { roles: string[] };
};

/**
 * @type {ExecutionContext}
 * @description Type definition for Pothos
 */
type BuilderType = {
	PrismaTypes: PrismaTypes;
	Scalars: {
		Upload: {
			Input: File;
			Output: File;
		};
	};
	Context: Context;
};

export const createBuilder = (prisma: PrismaClient) => {
	const builder = new SchemaBuilder<BuilderType>({
		plugins: [PrismaPlugin, PrismaUtils, PothosPrismaGeneratorPlugin],
		prisma: {
			client: prisma,
		},
		// authorization settings
		pothosPrismaGenerator: {
			authority: ({ context }) => context.user?.roles ?? [],
			replace: { '%%USER%%': ({ context }) => context.user?.id },
		},
	});
	return builder;
};

const customSchema = ({ builder, env }: { builder: ReturnType<typeof createBuilder>; env: Env }) => {
	// Add signIn mutation
	builder.mutationType({
		fields: (t) => ({
			signIn: t.prismaField({
				args: { email: t.arg({ type: 'String' }) },
				type: 'User',
				nullable: true,
				resolve: async (_query, _root, { email }, { setCookie }) => {
					const prisma = builder.options.prisma.client as PrismaClient;
					const user = email ? await prisma.user.findUnique({ include: { roles: true }, where: { email: email } }) : undefined;
					if (!user) {
						setCookie('auth-token', '', {
							httpOnly: true,
							sameSite: 'strict',
							path: '/',
							maxAge: 0,
							domain: undefined,
						});
					} else {
						const secret = env.SECRET;
						if (!secret) throw new Error('SECRET_KEY is not defined');
						const token = await new SignJWT({ user: { ...user, roles: user.roles.map((v) => v.name) } })
							.setProtectedHeader({ alg: 'HS256' })
							.sign(new TextEncoder().encode(secret));
						setCookie('auth-token', token, {
							httpOnly: true,
							maxAge: 1000 * 60 * 60 * 24 * 7,
							sameSite: 'strict',
							path: '/',
							domain: undefined,
						});
					}
					return user || null;
				},
			}),
		}),
	});
};

const schema = () => {
	let schema: GraphQLSchema;
	let builder: ReturnType<typeof createBuilder>;
	const createSchema = async ({ env }: { env: Env }) => {
		if (schema && builder) {
			// Update the prisma client
			// builder.options.prisma.client = prisma;
			return schema;
		}
		const adapter = new PrismaD1(env.DB);
		const prisma = new PrismaClient({ adapter });
		// Create a new schema
		builder = createBuilder(prisma);
		const Upload = new GraphQLScalarType({
			name: 'Upload',
		});
		builder.addScalarType('Upload', Upload, {});
		customSchema({ builder, env });
		schema = builder.toSchema();
		return schema;
	};
	return createSchema;
};

const yoga = createYoga<Context>({
	schema: schema(),
	fetchAPI: { Response },
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/':
				return new Response(explorer(await schema()({ env })), {
					headers: { 'content-type': 'text/html' },
				});
			case '/graphql':
				// Get the user from the token
				const cookies = parse(request.headers.get('Cookie') || '');
				const token = cookies['auth-token'];
				const secret = env.SECRET;
				const user = await jwtVerify(token, new TextEncoder().encode(secret))
					.then((data) => data.payload.user as User & { roles: string[] })
					.catch(() => undefined);
				// For cookie setting
				const responseCookies: string[] = [];
				const setCookie: typeof serialize = (name, value, options) => {
					const result = serialize(name, value, options);
					responseCookies.push(result);
					return result;
				};
				// Executing GraphQL queries
				const response = await yoga.handleRequest(request, {
					request,
					env,
					responseCookies,
					setCookie,
					cookies: {},
					user,
				});
				// Set the cookies
				responseCookies.forEach((v) => {
					response.headers.append('set-cookie', v);
				});
				return new Response(response.body, response);
		}
		return new Response('Not Found', { status: 404 });
	},
};

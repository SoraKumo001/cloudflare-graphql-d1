import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

type Env = {
	DB: D1Database;
};

const formatNumber = (num: number) => {
	return num.toString().padStart(2, '0');
};

export default async (env: Env) => {
	const adapter = new PrismaD1(env.DB);
	const prisma = new PrismaClient({ adapter });

	const roles = await prisma.role.count().then(async (count) => {
		if (!count) {
			return Promise.all(
				[
					{
						name: 'ADMIN',
					},
					{ name: 'USER' },
				].map((data) => {
					return prisma.role.create({
						data,
					});
				})
			);
		}
		return prisma.role.findMany();
	});

	if (roles === undefined) {
		throw new Error('roles is undefined');
	}
	const ROLES = Object.fromEntries(roles.map((v) => [v.name, v.id] as const));

	const users = await prisma.user.count().then(async (count) => {
		if (!count) {
			return Promise.all(
				[
					{
						name: 'admin',
						email: 'admin@example.com',
						roles: {
							connect: [
								{
									id: ROLES['ADMIN'],
								},
								{ id: ROLES['USER'] },
							],
						},
					},
					{ name: 'example', email: 'example@example.com', roles: { connect: [{ id: ROLES['USER'] }] } },
				].map((data) => {
					return prisma.user.create({
						data,
					});
				})
			);
		}
		return prisma.user.findMany();
	});

	// add category
	const categories = await prisma.category.count().then(async (count) => {
		if (!count) {
			return Promise.all(
				Array(10)
					.fill(0)
					.map((_, i) => ({ name: `Category${formatNumber(i + 1)}` }))
					.map((data) =>
						prisma.category.create({
							data,
						})
					)
			);
		}
		return prisma.category.findMany();
	});

	// add post
	await prisma.post.count().then(async (count) => {
		if (!count) {
			for (let i = 0; i < 30; i++) {
				await prisma.post.create({
					data: {
						title: `Post${formatNumber(i + 1)}`,
						content: `Post${formatNumber(i + 1)} content`,
						authorId: users[1].id,
						published: i % 4 !== 0,
						categories: {
							connect: [{ id: categories[i % 2].id }, { id: categories[i % 10].id }],
						},
					},
				});
			}
		}
	});
};

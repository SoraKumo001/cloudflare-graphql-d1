type WorkersFunction<Env = Record<string, unknown>> = (params: { request: Request; env: Env; ctx: ExecutionContext }) => Promise<void>;

type Env = {
	DB: D1Database;
};

const main: WorkersFunction<Env> = async ({ env }) => {
	console.log(JSON.stringify(env));
};

export default main;

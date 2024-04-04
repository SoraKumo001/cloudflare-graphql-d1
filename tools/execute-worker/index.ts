#!/usr/bin/env node

import { unstable_dev } from 'wrangler';
import fs from 'fs';
import path from 'path';
import minimist from 'minimist';
import '@colors/colors';
import { createHash } from 'crypto';

const tmpPath = '.wrangler/tmp';

const main = async () => {
	const argv = minimist(process.argv.slice(2), {
		alias: {
			r: 'remote',
			c: 'config',
			e: 'env',
			l: 'log',
		},
		boolean: ['remote'],
	});

	const scriptPath = argv._[0];

	if (!scriptPath) {
		console.log(`execute-worker\n`.blue);
		console.log('USAGE'.bold);
		console.log('\tcommand <path>');
		console.log('ARGUMENTS'.bold);
		console.log(`\t<path> Path to the script file`);
		console.log('OPTIONS'.bold);
		console.log(`\t-r, --remote Run remotely(Default is local)`);
		console.log(`\t-c, --config <path> Path to the wrangler config file(Default is wrangler.toml)`);
		console.log(`\t-e, --env <environment> Environment`);
		console.log(`\t-l, --log <logLevel> "log" | "none" | "info" | "error" | "warn" | "debug"`);
	} else {
		const config = argv.config ?? 'wrangler.toml';

		fs.mkdirSync(tmpPath, { recursive: true });
		const templateSrc = fs.readFileSync(path.join(__dirname, 'script.template'), 'utf8');
		const script = templateSrc.replace('{{SCRIPT_PATH}}', scriptPath);
		const executeFilePath = path.join(
			tmpPath,
			`execute-${createHash('sha1')
				.update(new Date().getTime() + script)
				.digest('hex')}.ts`
		);
		fs.writeFileSync(executeFilePath, script);

		const local = !argv.remote;
		const env = argv.env;
		const logLevel = argv.log;
		const worker = await unstable_dev(executeFilePath, {
			experimental: { disableExperimentalWarning: true, testMode: true },
			local,
			config,
			env,
			logLevel,
		});
		await worker.fetch('http://localhost/', { method: 'POST' });
		await worker.waitUntilExit();
		await worker.stop();
		fs.rmSync(executeFilePath);
		process.exit(0);
	}
};

main();

#!/usr/bin/env node

import { unstable_dev } from 'wrangler';
import fs from 'fs';
import path from 'path';
import minimist from 'minimist';
import '@colors/colors';

const tmpPath = '.wrangler/tmp';

const main = async () => {
	const argv = minimist(process.argv.slice(2), {
		alias: {
			r: 'remote',
			c: 'config',
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
	} else {
		const config = argv.config ?? 'wrangler.toml';

		fs.mkdirSync(tmpPath, { recursive: true });
		const templateSrc = fs.readFileSync(path.join(__dirname, 'script.template'), 'utf8');
		const script = templateSrc.replace('{{SCRIPT_PATH}}', scriptPath);
		const executeFilePath = path.join(tmpPath, 'execute.ts');
		fs.writeFileSync(executeFilePath, script);

		const local = !argv.remote;
		process.env.NODE_ENV = 'production';
		process.env.environment = 'production';
		const worker = await unstable_dev(executeFilePath, {
			experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
			local,
			config,
		});
		await worker.fetch('http://localhost/');
		await worker.waitUntilExit();
		await worker.stop();
		fs.rmSync(executeFilePath);
		process.exit(0);
	}
};

main();

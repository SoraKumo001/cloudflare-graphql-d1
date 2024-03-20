import fs from 'fs';

const srcPath = 'prisma/migrations';
const distPath = 'migrations';

if (fs.existsSync(distPath)) {
	fs.rmSync(distPath, { recursive: true });
}

fs.mkdirSync(distPath, { recursive: true });
const migrations = fs.readdirSync(srcPath, { withFileTypes: true });
migrations
	.filter((v) => {
		return v.isDirectory();
	})
	.sort((a, b) => (a.name < b.name ? -1 : 1))
	.forEach(({ name }) => {
		const sql = fs.readFileSync(`${srcPath}/${name}/migration.sql`, 'utf8');
		fs.writeFileSync(`${distPath}/${name}.sql`, sql);
	});

import { spawnSync } from 'node:child_process';
// Deliberately local-only. Demo records never ship as a production migration.
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'my-store-db', '--local', '--file=db/demo-seed.sql'], { stdio: 'inherit' });
process.exit(result.status ?? 1);

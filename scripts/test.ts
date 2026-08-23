
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const result = spawnSync(process.execPath, ['test', 'src/tests/', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, DSMX_HOME: join(tmpdir(), 'dsmx-test') },
});

process.exit(result.status ?? 1);
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = 'src/tests';
const env = { ...process.env, DSMX_HOME: join(tmpdir(), 'dsmx-test') };

const files = readdirSync(DIR)
  .filter(name => name.endsWith('.test.ts'))
  .map(name => join(DIR, name));

const failed: string[] = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['test', file, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env,
  });
  if (result.status !== 0) failed.push(file);
}

if (failed.length) {
  console.error(`\n${failed.length} of ${files.length} test files failed:`);
  for (const file of failed) console.error(`  ${file}`);
  process.exit(1);
}

console.error(`\n${files.length} test files passed`);

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = 'src/tests';

const files = readdirSync(DIR)
  .filter(name => name.endsWith('.test.ts'))
  .map(name => join(DIR, name));

const workers = Math.max(1, Math.min(availableParallelism(), files.length));
const shards = Array.from({ length: workers }, (_, i) => files.filter((_, n) => n % workers === i));

const box = mkdtempSync(join(tmpdir(), 'dsmx-test-'));

type Shard = { files: string[]; output: string; status: number; report: string };

function run(files: string[], index: number): Promise<Shard> {
  const report = join(box, `shard-${index}.xml`);
  const child = spawn(
    process.execPath,
    [
      'test',
      ...files,
      '--timeout',
      '30000',
      '--reporter=junit',
      `--reporter-outfile=${report}`,
      ...process.argv.slice(2),
    ],
    { env: { ...process.env, DSMX_HOME: join(box, `home-${index}`) } },
  );

  const chunks: Buffer[] = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stderr.on('data', chunk => chunks.push(chunk));

  return new Promise(resolve =>
    child.on('close', status =>
      resolve({ files, output: Buffer.concat(chunks).toString(), status: status ?? 1, report }),
    ),
  );
}

function failuresIn(shard: Shard): string[] {
  let xml = '';
  try {
    xml = readFileSync(shard.report, 'utf8');
  } catch {
    return shard.files;
  }

  const failed = new Set<string>();
  const seen = new Set<string>();
  for (const suite of xml.matchAll(/<testsuite\s([^>]*)>/g)) {
    const file = /\bfile="([^"]*)"/.exec(suite[1]);
    const failures = /\bfailures="(\d+)"/.exec(suite[1]);
    if (!file) continue;
    seen.add(file[1]);
    if (failures && failures[1] !== '0') failed.add(file[1]);
  }

  return shard.files.filter(
    file => failed.has(file) || (shard.status !== 0 && !seen.has(file)),
  );
}

const results = await Promise.all(shards.map(run));

for (const shard of results) process.stdout.write(shard.output);

const failed = results.flatMap(failuresIn);

rmSync(box, { recursive: true, force: true });

if (failed.length) {
  console.error(`\n${failed.length} of ${files.length} test files failed:`);
  for (const file of failed.sort()) console.error(`  ${file}`);
  process.exit(1);
}

console.error(`\n${files.length} test files passed`);

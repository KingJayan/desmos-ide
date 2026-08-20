// packs editors/vscode into the .vsix the marketplace takes
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const EXT_DIR = join(ROOT, 'editors', 'vscode');
const OUT_DIR = join(ROOT, 'build');

const grammar = spawnSync('bun', ['run', join(ROOT, 'scripts', 'build-grammar.ts')], { stdio: 'inherit' });
if (grammar.status !== 0) process.exit(grammar.status ?? 1);

await mkdir(OUT_DIR, { recursive: true });

const pkg = JSON.parse(await readFile(join(EXT_DIR, 'package.json'), 'utf8')) as { version: string };
const out = join(OUT_DIR, `desmos-dsl-${pkg.version}.vsix`);

const vsce = spawnSync(
  'bunx',
  ['@vscode/vsce', 'package', '--no-dependencies', '--out', out],
  { cwd: EXT_DIR, stdio: 'inherit' },
);
if (vsce.status !== 0) process.exit(vsce.status ?? 1);

console.log(out);

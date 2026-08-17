// packs the built cli into the tarball the homebrew formula downloads
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
const out = `build/dsmx-${pkg.version}.tar.gz`;

if (!existsSync('dist/cli/dsmx.mjs')) {
  console.error('pack-cli: run build:cli first');
  process.exit(1);
}

// -C, so the archive holds dsmx and dsmx.mjs at the top and the formula can
// install them without knowing a directory name
const tar = spawnSync('tar', ['-czf', out, '-C', 'dist/cli', '.'], { stdio: 'inherit' });
if (tar.status !== 0) process.exit(tar.status ?? 1);

const sum = spawnSync('shasum', ['-a', '256', out], { encoding: 'utf8' });
console.log(sum.stdout.trim() || out);

// compiles the swift dialog helpers ahead of the bundle

import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, readdir } from 'fs/promises';
import { join } from 'path';

const execFileAsync = promisify(execFile);

const SOURCE_DIR = join(import.meta.dir, '..', 'bun', 'native');
const OUT_DIR = join(import.meta.dir, '..', 'dist', 'native');

if (process.platform !== 'darwin') {
  console.log('build-native: not macOS, nothing to compile');
  process.exit(0);
}

const sources = (await readdir(SOURCE_DIR)).filter(f => f.endsWith('.swift'));
if (sources.length === 0) {
  console.error(`build-native: no .swift files in ${SOURCE_DIR}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

for (const file of sources) {
  const name = file.replace(/\.swift$/, '');
  await execFileAsync('swiftc', ['-O', join(SOURCE_DIR, file), '-o', join(OUT_DIR, name)]);
  console.log(`build-native: ${name}`);
}

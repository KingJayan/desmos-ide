
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };

const die = (message: string): never => {
  console.error(`pack-linux: ${message}`);
  process.exit(1);
};

const find = async (dir: string, depth: number, match: (name: string) => boolean): Promise<string | null> => {
  if (depth < 0 || !existsSync(dir)) return null;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await find(path, depth - 1, match);
      if (found) return found;
    } else if (match(entry.name)) {
      return path;
    }
  }
  return null;
};

const appimage = await find('build', 3, name => name.endsWith('.AppImage'));
if (!appimage) die('no .AppImage under build/ — did electrobun build --env=stable run?');

const name = `desmos-ide-${pkg.version}-linux-x86_64`;
const stage = join('build', name);
const out = join('build', `${name}.tar.gz`);

await rm(stage, { recursive: true, force: true });
await rm(out, { force: true });
await mkdir(stage, { recursive: true });

await copyFile(appimage!, join(stage, 'desmos-ide.AppImage'));
await chmod(join(stage, 'desmos-ide.AppImage'), 0o755);
await copyFile('packaging/linux/install.sh', join(stage, 'install.sh'));
await chmod(join(stage, 'install.sh'), 0o755);
await copyFile('packaging/linux/dsmx.desktop', join(stage, 'dsmx.desktop'));
await copyFile('packaging/linux/dsmx.xml', join(stage, 'dsmx.xml'));
await copyFile('docs/static/favicon-scalable.svg', join(stage, 'dsmx.svg'));

const tar = spawnSync('tar', ['-czf', out, '-C', 'build', name], { stdio: 'inherit' });
if (tar.status !== 0) process.exit(tar.status ?? 1);
await rm(stage, { recursive: true, force: true });

console.log(out);

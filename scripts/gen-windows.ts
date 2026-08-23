// renders the chocolatey package and the winget manifests from the templates in this
// repo, the same way gen-cask.ts renders the homebrew cask
//
//   bun run scripts/gen-windows.ts                        // version from package.json
//   bun run scripts/gen-windows.ts --version 1.5.7 --out build/windows
//   bun run scripts/gen-windows.ts --exe build/desmos-ide-Setup.exe
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const REPO = 'KingJayan/desmos-ide';
const ASSET = 'desmos-ide-Setup.exe';

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function die(message: string): never {
  console.error(`gen-windows: ${message}`);
  process.exit(1);
}

async function sha256Of(source: string): Promise<string | null> {
  if (!source.startsWith('http')) {
    return createHash('sha256').update(await readFile(source)).digest('hex');
  }
  const res = await fetch(source);
  if (!res.ok) return null;
  return createHash('sha256').update(new Uint8Array(await res.arrayBuffer())).digest('hex');
}

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
const version = flag('version') ?? pkg.version;
const url = `https://github.com/${REPO}/releases/download/v${version}/${ASSET}`;
const exe = flag('exe');

// the checksum has to be of the file people actually download, so a local exe is only
// used when it is handed over on purpose
const sha = await sha256Of(exe ?? url);
if (!sha) die(`no ${ASSET} for v${version} — is the release published with its windows asset?`);

const out = flag('out') ?? 'build/windows';
const choco = join(out, 'chocolatey');
const winget = join(out, 'winget');
await mkdir(join(choco, 'tools'), { recursive: true });
await mkdir(winget, { recursive: true });

const render = async (template: string, target: string): Promise<void> => {
  const text = (await readFile(template, 'utf8'))
    .replaceAll('{{VERSION}}', version)
    .replaceAll('{{URL}}', url)
    .replaceAll('{{SHA256}}', sha)
    .replaceAll('{{REPO}}', REPO);
  await writeFile(target, text);
  console.error(`wrote ${target}`);
};

await render('packaging/chocolatey/dsmx-app.nuspec.tmpl', join(choco, 'dsmx-app.nuspec'));
await render(
  'packaging/chocolatey/tools/chocolateyinstall.ps1.tmpl',
  join(choco, 'tools', 'chocolateyinstall.ps1'),
);
await copyFile(
  'packaging/chocolatey/tools/chocolateyuninstall.ps1',
  join(choco, 'tools', 'chocolateyuninstall.ps1'),
);
// the same script the release tarball carries, so there is one copy of the registry work
await copyFile('packaging/windows/register.ps1', join(choco, 'tools', 'register.ps1'));

for (const name of [
  'KingJayan.DesmosIDE.yaml',
  'KingJayan.DesmosIDE.installer.yaml',
  'KingJayan.DesmosIDE.locale.en-US.yaml',
]) {
  await render(`packaging/winget/${name}.tmpl`, join(winget, name));
}

console.log(out);

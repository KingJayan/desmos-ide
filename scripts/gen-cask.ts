// renders the homebrew cask from the template in this repo, the same way
// gen-formula.ts renders the cli formula
//
//   bun run scripts/gen-cask.ts                      # version from package.json
//   bun run scripts/gen-cask.ts --version 1.4.0 --out /tmp/dsmx-app.rb
//   bun run scripts/gen-cask.ts --zip build/desmos-ide-1.4.0-x86_64.zip
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const TEMPLATE = 'packaging/homebrew/dsmx-app.rb.tmpl';
const REPO = 'KingJayan/desmos-ide';
const APP = 'desmos-ide';

const ARCHES = [
  { key: 'arm', slug: 'arm64', symbol: ':arm64' },
  { key: 'intel', slug: 'x86_64', symbol: ':x86_64' },
] as const;

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function die(message: string): never {
  console.error(`gen-cask: ${message}`);
  process.exit(1);
}

async function sha256Of(source: string): Promise<string | null> {
  if (!source.startsWith('http')) return createHash('sha256').update(await readFile(source)).digest('hex');
  const res = await fetch(source);
  if (!res.ok) return null;
  return createHash('sha256').update(new Uint8Array(await res.arrayBuffer())).digest('hex');
}

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
const version = flag('version') ?? pkg.version;
const zip = flag('zip');

const found: { slug: string; key: string; symbol: string; sha: string }[] = [];
for (const arch of ARCHES) {
  const source = zip && zip.endsWith(`-${arch.slug}.zip`)
    ? zip
    : zip
      ? null
      : `https://github.com/${REPO}/releases/download/v${version}/${APP}-${version}-${arch.slug}.zip`;
  if (!source) continue;
  const sha = await sha256Of(source);
  if (sha) found.push({ ...arch, sha });
}

if (found.length === 0) die(`no ${APP} zip for v${version} — is the release published with its app asset?`);

let archStanzas: string;
let archRef: string;
let archDep = '';

if (found.length === ARCHES.length) {
  archStanzas = [
    `  arch arm: "arm64", intel: "x86_64"`,
    ``,
    `  version "${version}"`,
    `  sha256 arm:   "${found[0]!.sha}",`,
    `         intel: "${found[1]!.sha}"`,
  ].join('\n');
  archRef = '#{arch}';
} else {
  const only = found[0]!;
  archStanzas = [
    `  version "${version}"`,
    `  sha256 "${only.sha}"`,
  ].join('\n');
  archRef = only.slug;
  archDep = `  depends_on arch: ${only.symbol}\n`;
}

const cask = (await readFile(TEMPLATE, 'utf8'))
  .replaceAll('{{ARCH}}', archStanzas)
  .replaceAll('{{ARCHREF}}', archRef)
  .replaceAll('{{ARCHDEP}}', archDep)
  .replaceAll('{{APP}}', APP);

const out = flag('out');
if (out) {
  await writeFile(out, cask);
  console.error(`wrote ${out}  (v${version}, ${found.map((a) => a.slug).join(' + ')})`);
} else {
  process.stdout.write(cask);
}

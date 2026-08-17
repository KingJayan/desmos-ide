// renders the homebrew formula from the template in this repo, so the tap is
// always a copy of something that is reviewed here
//
//   bun run scripts/gen-formula.ts                     # version from package.json, sha from the release asset
//   bun run scripts/gen-formula.ts --version 1.3.0 --sha256 abc...
//   bun run scripts/gen-formula.ts --tarball dist/dsmx-1.3.0.tar.gz --out /tmp/dsmx.rb
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const TEMPLATE = 'packaging/homebrew/dsmx.rb.tmpl';
const REPO = 'KingJayan/desmos-ide';

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function die(message: string): never {
  console.error(`gen-formula: ${message}`);
  process.exit(1);
}

async function sha256Of(source: string): Promise<string> {
  const bytes = source.startsWith('http')
    ? new Uint8Array(await (await fetchOrDie(source)).arrayBuffer())
    : await readFile(source);
  return createHash('sha256').update(bytes).digest('hex');
}

async function fetchOrDie(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) die(`${url} returned ${res.status} — is the release published with its dsmx tarball?`);
  return res;
}

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
const version = flag('version') ?? pkg.version;

const tarball = flag('tarball');
const sha256 = flag('sha256')
  ?? await sha256Of(tarball ?? `https://github.com/${REPO}/releases/download/v${version}/dsmx-${version}.tar.gz`);

if (!/^[0-9a-f]{64}$/.test(sha256)) die(`${sha256} is not a sha256`);

const formula = (await readFile(TEMPLATE, 'utf8'))
  .replaceAll('{{VERSION}}', version)
  .replaceAll('{{SHA256}}', sha256);

const out = flag('out');
if (out) {
  await writeFile(out, formula);
  console.error(`wrote ${out}  (v${version})`);
} else {
  process.stdout.write(formula);
}

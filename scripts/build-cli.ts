// bundles the cli into one js file that plain node can run, so the homebrew
// formula needs no toolchain and no dependency install
import { mkdir, rm, writeFile, chmod, copyFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';

const OUT = 'dist/cli';

const WRAPPER = `#!/usr/bin/env bash
# resolves through symlinks, since homebrew puts a link in bin and the js sits in libexec
set -euo pipefail

self="\${BASH_SOURCE[0]}"
while [ -L "$self" ]; do
  target="$(readlink "$self")"
  case "$target" in
    /*) self="$target" ;;
    *)  self="$(dirname "$self")/$target" ;;
  esac
done
here="$(cd "$(dirname "$self")" && pwd)"

node="\${DSMX_NODE:-node}"
if ! command -v "$node" >/dev/null 2>&1; then
  echo "dsmx: needs node on PATH — install it, or set DSMX_NODE" >&2
  exit 1
fi

exec "$node" "$here/dsmx.mjs" "$@"
`;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const built = await Bun.build({
  entrypoints: ['cli/dsmx.ts'],
  target: 'node',
  format: 'esm',
  // .mjs, so node does not have to guess the module kind from a package.json
  naming: '[dir]/[name].mjs',
  minify: false,
  outdir: OUT,
});

if (!built.success) {
  for (const log of built.logs) console.error(log);
  process.exit(1);
}

await writeFile(`${OUT}/dsmx`, WRAPPER);
await chmod(`${OUT}/dsmx`, 0o755);

await mkdir(`${OUT}/example`, { recursive: true });
for (const name of await readdir('example')) {
  if (name.endsWith('.dsmx') || name === 'README.md') {
    await copyFile(`example/${name}`, `${OUT}/example/${name}`);
  }
}

await copyFile('LICENSE', `${OUT}/LICENSE`);

const bytes = (await Bun.file(`${OUT}/dsmx.mjs`).arrayBuffer()).byteLength;
console.log(`cli: ${OUT}/dsmx.mjs  ${(bytes / 1024).toFixed(0)} kB`);

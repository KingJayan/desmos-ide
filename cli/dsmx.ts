#!/usr/bin/env node
import { access, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { compile } from '../src/compile';
import { formatDsl } from '../src/compiler/format';
import { migrateDsl, needsMigration } from '../src/compiler/migrate';
import { ArgError, HELP, parseArgs, type Options } from './args';
import { openBrowser } from './open';
import { errorText, read, serve } from './serve';
import pkg from '../package.json' with { type: 'json' };

function die(message: string): never {
  console.error(`dsmx: ${message}`);
  process.exit(1);
}

async function readSource(path: string): Promise<string> {
  if (extname(path) !== '.dsmx') die(`${path} is not a .dsmx file`);
  try {
    await access(path);
  } catch {
    die(`no such file: ${path}`);
  }
  return read(path);
}

async function cmdBuild(opts: Options, path: string): Promise<void> {
  const result = compile(await readSource(path));
  if (!result.success) die(`${path} does not compile\n${errorText(result.errors)}`);

  const json = `${JSON.stringify(result.state, null, 2)}\n`;
  if (opts.out === '-') {
    process.stdout.write(json);
    return;
  }
  const out = opts.out ?? path.replace(/\.dsmx$/, '.json');
  await writeFile(out, json);
  console.log(`wrote ${out}  (${result.state.expressions.list.length} expressions)`);
}

async function cmdFmt(opts: Options, path: string): Promise<void> {
  const src = await readSource(path);
  const formatted = formatDsl(src);

  if (opts.check) {
    if (formatted === src) return;
    console.error(`${path} is not formatted`);
    process.exit(1);
  }
  if (formatted === src) {
    console.log(`${path} is already formatted`);
    return;
  }
  await writeFile(path, formatted);
  console.log(`formatted ${path}`);
}

async function cmdFix(opts: Options, path: string): Promise<void> {
  const src = await readSource(path);
  if (!needsMigration(src)) {
    if (!opts.check) console.log(`${path} already uses the current grammar`);
    return;
  }
  if (opts.check) {
    console.error(`${path} uses the older grammar`);
    process.exit(1);
  }
  await writeFile(path, migrateDsl(src));
  console.log(`migrated ${path}`);
}

async function cmdRun(opts: Options, path: string): Promise<void> {
  await readSource(path);

  const server = await serve({
    file: path, port: opts.port, host: opts.host, theme: opts.theme, watch: opts.watch,
  }).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') die(`port ${opts.port} is busy — pass --port to pick another`);
    throw err;
  });

  console.log(`serving  ${server.url}`);
  if (opts.watch) console.log(`watching ${path} — edit and save to redraw`);
  console.log('press ctrl-c to stop');

  if (opts.open && !openBrowser(server.url)) {
    console.log('could not open a browser — open the address above by hand');
  }

  const stop = (): void => { server.stop(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

async function main(): Promise<void> {
  let opts: Options;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof ArgError) die(`${e.message}\n\n${HELP}`);
    throw e;
  }

  if (opts.command === 'help')    { console.log(HELP); return; }
  if (opts.command === 'version') { console.log(pkg.version); return; }

  const path = resolve(opts.file as string);
  if (opts.command === 'build') return cmdBuild(opts, path);
  if (opts.command === 'fmt')   return cmdFmt(opts, path);
  if (opts.command === 'fix')   return cmdFix(opts, path);
  return cmdRun(opts, path);
}

await main();

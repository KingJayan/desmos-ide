import { createServer, type ServerResponse } from 'node:http';
import { readFile, watch as watchFile } from 'node:fs';
import { basename } from 'node:path';
import { compile, type DesmosState } from '../src/compile';
import { buildPage } from './page';

export interface ServeOptions {
  file: string;
  port: number;
  host: string;
  theme: 'dark' | 'light';
  watch: boolean;
}

export interface RunningServer {
  url: string;
  stop(): void;
}

/** one line per error, in the shape an editor gutter would use */
export function errorText(errors: { line?: number; col?: number; message: string }[]): string {
  return errors.map(e => `${e.line ?? '?'}:${e.col ?? '?'}  ${e.message}`).join('\n');
}

export type CompileOutcome =
  | { ok: true; state: DesmosState }
  | { ok: false; errors: string };

const BLANK: DesmosState = {
  version: 9,
  graph: { viewport: { xmin: -10, ymin: -10, xmax: 10, ymax: 10 } },
  expressions: { list: [] },
};

export function read(path: string): Promise<string> {
  return new Promise((ok, fail) => {
    readFile(path, 'utf8', (err, text) => (err ? fail(err) : ok(text)));
  });
}

export async function compileFile(path: string): Promise<CompileOutcome> {
  const result = compile(await read(path));
  return result.success
    ? { ok: true, state: result.state }
    : { ok: false, errors: errorText(result.errors) };
}

export function serve(opts: ServeOptions): Promise<RunningServer> {
  const title = basename(opts.file);
  const clients = new Set<ServerResponse>();

  function push(outcome: CompileOutcome): void {
    const frame = `data: ${JSON.stringify(outcome)}\n\n`;
    for (const client of clients) client.write(frame);
  }

  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];

    if (path === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      clients.add(res);
      res.on('close', () => clients.delete(res));
      return;
    }

    if (path !== '/') {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }

    // the page still has to load when the file does not compile, so the banner has
    // somewhere to appear and a later save can fix it in place
    compileFile(opts.file).then(result => {
      const html = buildPage(result.ok ? result.state : BLANK, {
        title,
        theme: opts.theme,
        live: opts.watch,
        error: result.ok ? null : result.errors,
      });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    }, err => {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(err));
    });
  });

  let watcher: ReturnType<typeof watchFile> | null = null;
  if (opts.watch) {
    let pending: ReturnType<typeof setTimeout> | null = null;
    watcher = watchFile(opts.file, () => {
      // an editor writes a file in more than one step, so the last event wins
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { void compileFile(opts.file).then(push, () => {}); }, 40);
    });
  }

  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(opts.port, opts.host, () => {
      ok({
        url: `http://${opts.host}:${opts.port}`,
        stop() {
          watcher?.close();
          for (const client of clients) client.end();
          server.close();
        },
      });
    });
  });
}

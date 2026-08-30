/// <reference types="node" />
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArgError, parseArgs } from '../../cli/args';
import { openCommand } from '../../cli/open';
import { buildPage, embed, scaleFills } from '../../cli/page';
import { compileFile, errorText, serve } from '../../cli/serve';
import type { DesmosState } from '../compile';

const dir = mkdtempSync(join(tmpdir(), 'dsmx-cli-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function fixture(name: string, src: string): string {
  const path = join(dir, name);
  writeFileSync(path, src);
  return path;
}

describe('the command line', () => {
  test('a bare path means run it', () => {
    const opts = parseArgs(['orbit.dsmx']);
    assert.equal(opts.command, 'run');
    assert.equal(opts.file, 'orbit.dsmx');
  });

  test('a command in front of the path is taken as the command', () => {
    assert.equal(parseArgs(['build', 'a.dsmx']).command, 'build');
    assert.equal(parseArgs(['fmt', 'a.dsmx']).file, 'a.dsmx');
  });

  test('a file named like a command is still the file, once a command is given', () => {
    const opts = parseArgs(['fmt', 'build']);
    assert.equal(opts.command, 'fmt');
    assert.equal(opts.file, 'build');
  });

  test('help and version need no file', () => {
    assert.equal(parseArgs(['--help']).command, 'help');
    assert.equal(parseArgs(['-v']).command, 'version');
  });

  test('every other command asks for one', () => {
    assert.throws(() => parseArgs(['run']), ArgError);
  });

  test('flags come before or after the path', () => {
    const before = parseArgs(['run', '--port', '9000', 'a.dsmx']);
    const after  = parseArgs(['run', 'a.dsmx', '--port', '9000']);
    assert.equal(before.port, 9000);
    assert.deepEqual(before, after);
  });

  test('a lone dash is stdout, not another flag', () => {
    assert.equal(parseArgs(['build', 'a.dsmx', '-o', '-']).out, '-');
  });

  test('a port outside the range is refused', () => {
    assert.throws(() => parseArgs(['run', 'a.dsmx', '--port', '70000']), ArgError);
    assert.throws(() => parseArgs(['run', 'a.dsmx', '--port', 'eight']), ArgError);
  });

  test('only the two themes are accepted', () => {
    assert.equal(parseArgs(['run', 'a.dsmx', '--theme', 'light']).theme, 'light');
    assert.throws(() => parseArgs(['run', 'a.dsmx', '--theme', 'solarized']), ArgError);
  });

  test('an unknown flag is refused rather than read as a path', () => {
    assert.throws(() => parseArgs(['run', '--fast', 'a.dsmx']), ArgError);
  });

  test('two paths are refused', () => {
    assert.throws(() => parseArgs(['run', 'a.dsmx', 'b.dsmx']), ArgError);
  });

  test('watching and opening are on unless turned off', () => {
    const on = parseArgs(['run', 'a.dsmx']);
    assert.equal(on.open, true);
    assert.equal(on.watch, true);
    const off = parseArgs(['run', 'a.dsmx', '--no-open', '--no-watch']);
    assert.equal(off.open, false);
    assert.equal(off.watch, false);
  });
});

describe('handing the url to a browser', () => {
  test('each desktop gets the opener it ships with', () => {
    assert.deepEqual(openCommand('darwin', 'http://x'), ['open', 'http://x']);
    assert.deepEqual(openCommand('linux', 'http://x'), ['xdg-open', 'http://x']);
  });

  test('an unknown platform reports that it cannot, rather than guessing', () => {
    assert.equal(openCommand('aix', 'http://x'), null);
  });
});

describe('the page the cli serves', () => {
  const state: DesmosState = {
    version: 9,
    graph: { viewport: { xmin: -1, ymin: -1, xmax: 1, ymax: 1 } },
    expressions: { list: [{ type: 'expression', id: 'a', latex: 'a=1' }] },
  };

  test('a closing tag inside the data cannot end the script', () => {
    assert.ok(!embed({ latex: '</script>' }).includes('</script>'));
  });

  test('the compiled state travels in the page', () => {
    const html = buildPage(state, { title: 'a.dsmx', theme: 'dark', live: false, error: null });
    assert.ok(html.includes('a=1'), 'the expression is missing');
    assert.ok(html.includes('<title>a.dsmx</title>'));
  });

  test('a file name with markup in it cannot become markup', () => {
    const html = buildPage(state, { title: '<img>.dsmx', theme: 'dark', live: false, error: null });
    assert.ok(!html.includes('<img>'), html.slice(0, 200));
  });

  test('the reload listener is only there when the file is watched', () => {
    const live = buildPage(state, { title: 'a', theme: 'dark', live: true, error: null });
    const once = buildPage(state, { title: 'a', theme: 'dark', live: false, error: null });
    assert.ok(live.includes('EventSource'));
    assert.ok(!once.includes('EventSource'));
  });

  test('a file that does not compile still loads, with the errors on it', () => {
    const html = buildPage(state, { title: 'a', theme: 'dark', live: true, error: '3:1  bad' });
    assert.ok(html.includes('3:1  bad'));
  });

  test('a light background takes a lighter share of a stated fill', () => {
    const filled: DesmosState = {
      ...state,
      expressions: { list: [{ type: 'expression', id: 'r', latex: 'y>x', fillOpacity: '0.2' }] },
    };
    assert.equal(scaleFills(filled, 0.55).expressions.list[0].fillOpacity, '0.11');
    assert.equal(scaleFills(filled, 1).expressions.list[0].fillOpacity, '0.2');
  });

  test('an opacity the dsl wrote as an expression is left alone', () => {
    const filled: DesmosState = {
      ...state,
      expressions: { list: [{ type: 'expression', id: 'r', latex: 'y>x', fillOpacity: 'a/2' }] },
    };
    assert.equal(scaleFills(filled, 0.55).expressions.list[0].fillOpacity, 'a/2');
  });
});

describe('reading a file for the graph', () => {
  test('a compile gives back the state', async () => {
    const path = fixture('ok.dsmx', 'point p = (1, 2)\n');
    const out = await compileFile(path);
    assert.ok(out.ok);
    assert.equal(out.state.expressions.list.length, 1);
  });

  test('a failure gives back one line for each error', async () => {
    const path = fixture('bad.dsmx', 'point p = (1, 2)\nnot the dsl\n');
    const out = await compileFile(path);
    assert.ok(!out.ok);
    assert.match(out.errors, /^2:1 {2}/);
  });

  test('an error with no position still gets a line', () => {
    assert.equal(errorText([{ message: 'broke' }]), '?:?  broke');
  });
});

describe('the server', () => {
  test('the root serves the graph and anything else is a miss', async () => {
    const path = fixture('served.dsmx', 'circle c = circle(center=(0, 0), radius=3)\n');
    const server = await serve({ file: path, port: 7791, host: '127.0.0.1', theme: 'dark', watch: false });
    try {
      const page = await fetch(`${server.url}/`);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Desmos\.GraphingCalculator/);

      const missing = await fetch(`${server.url}/nothing`);
      assert.equal(missing.status, 404);
    } finally {
      server.stop();
    }
  });

  test('a file that does not compile is served rather than refused', async () => {
    const path = fixture('broken.dsmx', 'not the dsl\n');
    const server = await serve({ file: path, port: 7792, host: '127.0.0.1', theme: 'dark', watch: false });
    try {
      const page = await fetch(`${server.url}/`);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Expected a statement/);
    } finally {
      server.stop();
    }
  });
});

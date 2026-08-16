/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  pushRecent, removeRecent, recentLabel, parseRecent, parseSession, RECENT_LIMIT,
} from '../../renderer/session';
import { buildMatcher, collectFiles, findMatches, searchFolder, searchPaths } from '../../bun/search';
import { fileURLToPath } from 'node:url';

describe('recent files', () => {
  test('puts the newest first', () => {
    const list = pushRecent(pushRecent([], '/a.dsmx'), '/b.dsmx');
    assert.deepEqual(list.map(f => f.path), ['/b.dsmx', '/a.dsmx']);
  });

  test('reopening a file moves it up instead of duplicating it', () => {
    let list = pushRecent(pushRecent([], '/a.dsmx'), '/b.dsmx');
    list = pushRecent(list, '/a.dsmx');
    assert.deepEqual(list.map(f => f.path), ['/a.dsmx', '/b.dsmx']);
  });

  test('caps the list', () => {
    let list: ReturnType<typeof pushRecent> = [];
    for (let i = 0; i < RECENT_LIMIT + 8; i++) list = pushRecent(list, `/f${i}.dsmx`);
    assert.equal(list.length, RECENT_LIMIT);
    assert.equal(list[0].path, `/f${RECENT_LIMIT + 7}.dsmx`);
  });

  test('ignores an empty path', () => {
    assert.deepEqual(pushRecent([], ''), []);
  });

  test('removes a path', () => {
    const list = pushRecent(pushRecent([], '/a.dsmx'), '/b.dsmx');
    assert.deepEqual(removeRecent(list, '/b.dsmx').map(f => f.path), ['/a.dsmx']);
  });
});

describe('recent file labels', () => {
  test('is the basename when nothing clashes', () => {
    const l = recentLabel('/home/j/work/curve.dsmx', ['/home/j/work/curve.dsmx']);
    assert.equal(l.name, 'curve.dsmx');
  });

  test('keeps enough parents to tell same-named files apart', () => {
    const paths = ['/a/one/demo.dsmx', '/a/two/demo.dsmx'];
    const l = recentLabel('/a/one/demo.dsmx', paths);
    assert.equal(l.name, 'demo.dsmx');
    assert.equal(l.hint, 'a/one');
  });
});

describe('stored state is never trusted', () => {
  test('survives malformed json', () => {
    assert.deepEqual(parseRecent('{{{'), []);
    assert.equal(parseSession('not json'), null);
    assert.equal(parseSession(null), null);
  });

  test('drops recent entries with no path', () => {
    assert.deepEqual(parseRecent('[{"openedAt":1},{"path":"/a"}]').map(f => f.path), ['/a']);
  });

  test('a session with no source is not a session', () => {
    assert.equal(parseSession('{"path":"/a.dsmx"}'), null);
  });

  test('clamps a nonsense cursor to the start of the file', () => {
    const s = parseSession('{"source":"x = 1","line":-4,"col":null}')!;
    assert.equal(s.line, 1);
    assert.equal(s.col, 1);
  });

  test('never restores into enhanced mode, which does not edit the file', () => {
    assert.equal(parseSession('{"source":"x = 1","mode":"enhanced"}')!.mode, 'dsl');
    assert.equal(parseSession('{"source":"x = 1","mode":"split"}')!.mode, 'split');
    assert.equal(parseSession('{"source":"x = 1","mode":"nonsense"}')!.mode, 'dsl');
  });
});

describe('search across recent files', () => {
  const src = 'a = slider(1, 0, 10)\nb = a * 2\n// a comment about a\n';

  test('plain text is matched literally, not as a pattern', () => {
    const m = buildMatcher('a * 2', false)!;
    assert.deepEqual(findMatches(src, m, '/f').map(h => h.line), [2]);
    assert.equal(buildMatcher('(', false)!.test('('), true);
  });

  test('regex mode compiles the pattern', () => {
    const m = buildMatcher('^b\\s*=', true)!;
    assert.deepEqual(findMatches(src, m, '/f').map(h => h.line), [2]);
  });

  test('an invalid regex gives no matcher rather than throwing', () => {
    assert.equal(buildMatcher('(unclosed', true), null);
    assert.equal(buildMatcher('', false), null);
  });

  test('matching is case-insensitive', () => {
    assert.equal(findMatches(src, buildMatcher('SLIDER', false)!, '/f').length, 1);
  });

  test('reports every occurrence, with the column', () => {
    const hits = findMatches(src, buildMatcher('a', false)!, '/f');
    assert.deepEqual(hits.map(h => h.line), [1, 2, 3, 3, 3]);
    assert.equal(hits[0].col, 1);
    assert.equal(hits[1].col, 5);
    assert.deepEqual(hits.slice(2).map(h => h.col), [4, 14, 20]);
  });

  test('counts two matches on one line as two', () => {
    const hits = findMatches('y = sin(x) + sin(y)', buildMatcher('sin', false)!, '/f');
    assert.equal(hits.length, 2);
    assert.deepEqual(hits.map(h => h.col), [5, 14]);
  });

  test('a pattern that can match empty still terminates', () => {
    const hits = findMatches('abc', buildMatcher('x*', true)!, '/f', 10);
    assert.ok(hits.length <= 10);
  });

  test('honours the hit limit', () => {
    const many = Array.from({ length: 40 }, () => 'x = 1').join('\n');
    assert.equal(findMatches(many, buildMatcher('x', false)!, '/f', 5).length, 5);
  });

  test('a global matcher is reusable across files', () => {
    const m = buildMatcher('a', false)!;
    const first = findMatches(src, m, '/one');
    const second = findMatches(src, m, '/two');
    assert.deepEqual(first.map(h => h.line), second.map(h => h.line));
  });

  test('the hit limit still holds when one line matches many times', () => {
    const line = 'x '.repeat(50);
    assert.equal(findMatches(line, buildMatcher('x', false)!, '/f', 7).length, 7);
  });

  test('trims long lines for display only', () => {
    const long = `${'z'.repeat(400)}target`;
    const hits = findMatches(long, buildMatcher('target', false)!, '/f');
    assert.equal(hits.length, 1);
    assert.ok(hits[0].text.length < 250);
  });
});

describe('searching real files', () => {
  const example = fileURLToPath(new URL('../../example/demo.dsmx', import.meta.url));

  test('finds a term in the example file', async () => {
    const r = await searchPaths([example], 'slider', false);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.scanned, 1);
    assert.ok(r.hits.length > 0);
    assert.ok(r.hits.every(h => h.path === example));
  });

  test('a missing path is skipped, not an error', async () => {
    const r = await searchPaths(['/no/such/file.dsmx', example], 'slider', false);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.scanned, 1);
  });

  test('an invalid regex is reported to the user', async () => {
    const r = await searchPaths([example], '(unclosed', true);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.errorCode, 'BAD_QUERY');
  });
});

describe('searching a folder', () => {
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const exampleDir = fileURLToPath(new URL('../../example/', import.meta.url));

  test('walks the folder and finds the example', async () => {
    const files = await collectFiles(exampleDir);
    assert.ok(files.some(f => f.endsWith('demo.dsmx')), files.join(', '));
  });

  test('skips node_modules and other build output', async () => {
    const files = await collectFiles(repo);
    assert.equal(files.filter(f => f.includes('/node_modules/')).length, 0);
    assert.equal(files.filter(f => f.includes('/dist/')).length, 0);
  });

  test('skips dot directories', async () => {
    const files = await collectFiles(repo);
    assert.equal(files.filter(f => f.includes('/.git/')).length, 0);
  });

  test('only collects searchable extensions', async () => {
    const files = await collectFiles(repo);
    assert.ok(files.length > 0);
    assert.ok(files.every(f => /\.(dsmx|json|txt|md)$/.test(f)), 'unexpected extension');
  });

  test('finds a term anywhere under the folder', async () => {
    const r = await searchFolder(exampleDir, 'slider', false);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.hits.length > 0);
  });

  test('a folder that does not exist gives no hits, not an error', async () => {
    const r = await searchFolder('/no/such/folder', 'x', false);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.hits.length, 0);
  });

  test('an empty root is refused', async () => {
    const r = await searchFolder('', 'x', false);
    assert.equal(r.ok, false);
  });
});

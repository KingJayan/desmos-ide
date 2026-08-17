/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../compile';
import { parseManifest, parseRegistry, pluginFiles } from '../plugin/manifest';
import { applyMacros, findMacros, toSourceLine } from '../plugin/macro';
import { remapResult } from '../plugin/remap';
import { matches, mergeViews } from '../../renderer/plugins/actions';
import type { InstalledPlugin } from '../plugin/manifest';

const GOOD = {
  id: 'starfield',
  name: 'Starfield',
  version: '1.2.0',
  description: 'scatters points',
  author: 'someone',
  main: 'main.js',
  lib: 'lib.dsmx',
};

describe('the manifest is the gate', () => {
  test('a complete manifest survives', () => {
    const m = parseManifest(GOOD);
    assert.equal(m?.id, 'starfield');
    assert.equal(m?.main, 'main.js');
  });

  test('a missing required field is refused', () => {
    for (const field of ['id', 'name', 'version', 'description', 'author']) {
      const broken = { ...GOOD, [field]: undefined };
      assert.equal(parseManifest(broken), null, field);
    }
  });

  test('an id that is not a plain name is refused', () => {
    for (const id of ['A', '1st', 'has space', 'has/slash', '-lead', 'x']) {
      assert.equal(parseManifest({ ...GOOD, id }), null, id);
    }
  });

  test('a version that is not semver is refused', () => {
    for (const version of ['1', '1.2', 'v1.2.3', 'latest']) {
      assert.equal(parseManifest({ ...GOOD, version }), null, version);
    }
  });

  test('a path that climbs out of the plugin folder is dropped', () => {
    const m = parseManifest({ ...GOOD, main: '../../etc/passwd' });
    assert.equal(m?.main, undefined);
  });

  test('an http homepage is dropped, https is kept', () => {
    assert.equal(parseManifest({ ...GOOD, homepage: 'http://x.dev' })?.homepage, undefined);
    assert.equal(parseManifest({ ...GOOD, homepage: 'https://x.dev' })?.homepage, 'https://x.dev');
  });

  test('a theme keeps only colours that are colours', () => {
    const m = parseManifest({
      ...GOOD,
      theme: { dark: true, editor: { 'editor.background': '#101010', bad: 'red' }, tokens: {} },
    });
    assert.deepEqual(m?.theme?.editor, { 'editor.background': '#101010' });
  });

  test('the files a plugin may carry are only the ones it names', () => {
    assert.deepEqual(pluginFiles(parseManifest(GOOD)!), ['plugin.json', 'README.md', 'main.js', 'lib.dsmx']);
  });
});

describe('the registry index is the gate too', () => {
  test('a bad row is skipped and the good ones stay', () => {
    const index = parseRegistry({
      plugins: [{ manifest: GOOD, path: 'plugins/starfield' }, { manifest: { id: 'no' } }, 'junk'],
    });
    assert.deepEqual(index.plugins.map(p => p.manifest.id), ['starfield']);
    assert.equal(index.plugins[0]!.path, 'plugins/starfield');
  });

  test('a repeated id is listed once', () => {
    const index = parseRegistry({ plugins: [{ manifest: GOOD }, { manifest: GOOD }] });
    assert.equal(index.plugins.length, 1);
  });

  test('anything that is not an index reads as empty', () => {
    for (const raw of [null, 42, {}, { plugins: 'no' }]) {
      assert.deepEqual(parseRegistry(raw).plugins, []);
    }
  });
});

describe('macro calls are found on their own lines', () => {
  test('a call with numbers and strings is read', () => {
    const { sites } = findMacros('a = 1\n@stars(120, 6, "blue")\n');
    assert.deepEqual(sites, [{ line: 2, macro: 'stars', args: [120, 6, 'blue'] }]);
  });

  test('a call with no arguments is read', () => {
    const { sites } = findMacros('@grid()\n');
    assert.deepEqual(sites[0]!.args, []);
  });

  test('a comma inside a string does not split the arguments', () => {
    const { sites } = findMacros('@label("a, b", 2)\n');
    assert.deepEqual(sites[0]!.args, ['a, b', 2]);
  });

  test('an argument that is not a literal is an error, not a call', () => {
    const { sites, errors } = findMacros('@stars(n)\n');
    assert.equal(sites.length, 0);
    assert.equal(errors[0]!.line, 1);
  });

  test('a call that is not alone on its line is left to the compiler', () => {
    assert.equal(findMacros('a = @stars(1)\n').sites.length, 0);
  });
});

describe('expansion keeps a way back to the source line', () => {
  test('one line becomes many, and all of them point back', () => {
    const src = 'a = 1\n@stars(2)\nb = 2\n';
    const { src: out, lineMap } = applyMacros(src, new Map([[2, 'point p (0,0)\npoint q (1,1)']]));

    assert.deepEqual(out.split('\n'), ['a = 1', 'point p (0,0)', 'point q (1,1)', 'b = 2', '']);
    assert.deepEqual(lineMap, [1, 2, 2, 3, 4]);
    assert.equal(toSourceLine(lineMap, 3), 2);
    assert.equal(toSourceLine(lineMap, 4), 3);
  });

  test('a call nothing expanded is commented out, not left for the lexer', () => {
    const { src } = applyMacros('@stars(2)\n', new Map());
    assert.equal(src.split('\n')[0], '// @stars(2)');
  });

  test('a source with no macros is unchanged', () => {
    const src = 'a = 1\nb = 2\n';
    assert.equal(applyMacros(src, new Map()).src, src);
  });

  test('an error under a macro is reported on the line the user wrote', () => {
    const src = '@stars(2)\nc = nope\n';
    const { src: out, lineMap } = applyMacros(src, new Map([[1, 'a = 1\nb = 2\nd = 3']]));
    const result = remapResult(compile(out), lineMap);

    assert.equal(result.success, false);
    assert.equal((result as { errors: { line?: number }[] }).errors[0]!.line, 2);
  });

  test('a warning under a macro moves back too', () => {
    const { src, lineMap } = applyMacros('@gen()\nalias k = 1\n', new Map([[1, 'a = 1\nb = 2']]));
    const result = remapResult(compile(src), lineMap);
    assert.equal(result.success, true);
    const warned = (result as { warnings: { startLineNumber: number }[] }).warnings;
    assert.equal(warned[0]!.startLineNumber, 2);
  });
});

describe('a plugin library reaches the compiler as a prelude', () => {
  const lib = 'fn twice(x) = 2*x\n';

  test('a file can call what the plugin declared', () => {
    assert.equal(compile('a = twice(3)\n', { prelude: lib }).success, true);
  });

  test('the same file without the plugin does not compile', () => {
    assert.equal(compile('a = twice(3)\n').success, false);
  });

  test('the prelude is not in the outline and raises no warning', () => {
    const r = compile('a = twice(3)\n', { prelude: lib });
    assert.equal(r.success, true);
    const ok = r as Extract<typeof r, { success: true }>;
    assert.deepEqual(ok.symbols.map(s => s.name), ['a']);
    assert.deepEqual(ok.warnings, []);
  });

  test('a prelude that does not compile is dropped whole, not blamed on the file', () => {
    const r = compile('a = 1\n', { prelude: 'fn broken(x) = missing_thing(x)\n' });
    assert.equal(r.success, true);
  });

  test('a plugin function is not put on the graph, used or not', () => {
    for (const src of ['a = 1\n', 'a = twice(3)\n']) {
      const r = compile(src, { prelude: lib });
      const list = (r as Extract<typeof r, { success: true }>).state.expressions.list;
      assert.equal(list.length, 1, src);
      assert.equal(list.some(e => e.id === 'twice'), false, src);
    }
  });

  test('a function the user declares is drawn, even when a plugin names it too', () => {
    const r = compile('fn twice(x) = 3*x\nb = twice(2)\n', { prelude: lib });
    const list = (r as Extract<typeof r, { success: true }>).state.expressions.list;
    assert.equal(list.some(e => e.id === 'twice'), true);
  });

  test('a prelude may not draw anything', () => {
    const r = compile('a = 1\n', { prelude: 'point sneaky (9, 9)\n' });
    assert.equal(r.success, true);
    const ids = (r as Extract<typeof r, { success: true }>).state.expressions.list.map(e => e.id);
    assert.equal(ids.includes('sneaky'), false);
  });
});

describe('`use` pins a plugin', () => {
  test('the ids a file pins are reported', () => {
    const r = compile('use "starfield"\nuse "lissajous"\na = 1\n');
    assert.deepEqual((r as Extract<typeof r, { success: true }>).uses, ['starfield', 'lissajous']);
  });

  test('a use produces nothing on the graph', () => {
    const r = compile('use "starfield"\na = 1\n');
    const list = (r as Extract<typeof r, { success: true }>).state.expressions.list;
    assert.equal(list.length, 1);
  });

  test('a use of a plugin that is not loaded is an error at that line', () => {
    const r = compile('a = 1\nuse "missing"\n', { available: ['starfield'] });
    assert.equal(r.success, false);
    const errors = (r as Extract<typeof r, { success: false }>).errors;
    assert.match(errors[0]!.message, /missing/);
    assert.equal(errors[0]!.line, 2);
  });

  test('a use is accepted when nothing says what is available', () => {
    assert.equal(compile('use "anything"\na = 1\n').success, true);
  });
});

describe('the plugin list merges what is installed with what is listed', () => {
  const installed: InstalledPlugin[] = [{
    manifest: parseManifest(GOOD)!,
    main: null, lib: null, readme: null, enabled: false,
  }];
  const registry = parseRegistry({
    plugins: [{ manifest: GOOD }, { manifest: { ...GOOD, id: 'other', name: 'Other' } }],
  }).plugins;

  test('an installed plugin is not offered a second time', () => {
    const views = mergeViews(installed, registry);
    assert.deepEqual(views.map(v => v.manifest.id), ['other', 'starfield']);
  });

  test('the installed copy carries the enabled state', () => {
    const view = mergeViews(installed, registry).find(v => v.manifest.id === 'starfield');
    assert.equal(view?.installed, true);
    assert.equal(view?.enabled, false);
  });

  test('search reads the name, the id, the blurb and the keywords', () => {
    const view = mergeViews(installed, registry)[1]!;
    for (const q of ['star', 'SCATTERS', 'someone', '']) assert.equal(matches(view, q), true, q);
    assert.equal(matches(view, 'lissajous'), false);
  });
});

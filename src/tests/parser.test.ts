/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../index';
import type { CompileSuccess, CompileFailure } from '../index';
import { BUILTIN_FNS, buildCompletions } from '../monaco/language';
import { builtinSignature } from '../compiler/builtins';
import { formatDsl } from '../compiler/format';
import { readFileSync } from 'node:fs';

function ok(src: string): CompileSuccess {
  const r = compile(src);
  if (!r.success) throw new Error(`expected success, got: ${(r as CompileFailure).errors[0]?.message}`);
  return r;
}

function fail(src: string): string {
  const r = compile(src);
  if (r.success) throw new Error(`expected failure for: ${src}`);
  return (r as CompileFailure).errors[0].message;
}

describe('parser — happy path', () => {
  test('var decl',           () => { ok('x = 3'); });
  test('alias decl',         () => { ok('alias k = 2'); });
  test('fn decl',            () => { ok('fn f(a, b) = a + b'); });
  test('point',              () => { ok('point p (1, 2)'); });
  test('circle call form',   () => { ok('circle c = circle((0,0), 1)'); });
  test('line slope-intercept', () => { ok('line l = slope(2), intercept(1)'); });
  test('line standard form', () => { ok('line l = 2*x + y = 4'); });
  test('curve parametric',   () => { ok('curve r (t in 0..6.28) { (cos(t), sin(t)) }'); });
  test('region',             () => { ok('region r = y > x^2'); });
  test('polygon',            () => { ok('polygon tri = [(0,0), (1,0), (0,1)]'); });
  test('segment',            () => { ok('segment s = (0,0) -> (1,1)'); });
  test('text',               () => { ok('text lbl = "hello" at (1, 2)'); });
  test('group',              () => { ok('group g as "Folder"'); });
  test('spiral',             () => { ok('spiral s = spiral(turns=5, spacing=0.2)'); });
  test('wave',               () => { ok('wave w = wave(freq=2, amp=1)'); });
  test('grid',               () => { ok('grid g = grid(10, 10)'); });
  test('slider',             () => { ok('a = slider(0, 0, 10)'); });
  test('conditional where/else', () => { ok('v = x^2 where x > 0 else -x'); });
  test('piecewise',          () => { ok('z = { x > 0: x^2, else: 0 }'); });
  test('for-expr',           () => { ok('pts = (cos(t), sin(t)) for t in 0..6.28'); });
  test('domain restriction', () => { ok('y = x^2 domain x > 0'); });
  test('debug stripped',     () => { ok('debug 3 + 4'); });
});

describe('semantic errors', () => {
  test('undefined function', () => {
    const msg = fail('x = undefined_fn(1)');
    assert.ok(msg.toLowerCase().includes('undefined function') || msg.includes('undefined_fn'));
  });

  test('arity mismatch', () => {
    const msg = fail('fn f(a) = a\nx = f(1, 2)');
    assert.ok(msg.includes('1') || msg.includes('argument'));
  });

  test('undefined function call', () => {
    const msg = fail('x = noSuchFunc(1)');
    assert.ok(msg.includes('noSuchFunc'));
  });

  test('undefined variable', () => {
    const msg = fail('y = undefinedThing + 1');
    assert.ok(msg.includes('undefinedThing'));
  });

  test('declaration order does not matter', () => {
    ok('y = later + 1\nlater = 2');
  });

  test('fn params and loop vars are in scope', () => {
    ok('fn f(a, b) = a + b\npts = (cos(i), sin(i)) for i in 0..6');
  });
});

describe('statement terminators', () => {
  test('a line cannot merge into the previous statement', () => {
    fail('a = 5\n-3\nb = 2');
  });

  test('adjacent statements stay separate', () => {
    const r = ok('a = 5\nb = 2');
    assert.equal(r.state.expressions.list.length, 2);
  });

  test('a trailing operator continues the line', () => {
    ok('a = 1 +\n  2');
  });

  test('blocks and lists still span lines', () => {
    ok('curve ring (t in 0..6.28) {\n  (cos(t), sin(t))\n}');
    ok('z = { x > 0: x^2,\n  else: 0 }');
    ok('polygon tri = [\n  (0,0),\n  (1,0)\n]');
  });
});

describe('warnings', () => {
  test('reserved name warning', () => {
    const r = ok('t = 5');
    assert.ok(r.warnings.some(w => w.message.includes('built-in')));
  });

  test('duplicate declaration warning', () => {
    const r = ok('x = 1\nx = 2');
    assert.ok(r.warnings.some(w => w.message.includes('already declared')));
  });

  test('unused fn warning', () => {
    const r = ok('fn helper(a) = a * 2\npoint p (1, 2)');
    assert.ok(r.warnings.some(w => w.message.includes('never used')));
  });

  test('unused alias warning', () => {
    const r = ok('alias k = 42\npoint p (1, 2)');
    assert.ok(r.warnings.some(w => w.message.includes('never used')));
  });

  test('used fn has no unused warning', () => {
    const r = ok('fn f(a) = a^2\nx = f(3)');
    assert.ok(!r.warnings.some(w => w.message.includes("'f'") && w.message.includes('never used')));
  });
});

describe('compile error shape', () => {
  test('error has message field', () => {
    const r = compile('x = @@');
    if (r.success) throw new Error('expected failure');
    assert.ok(typeof r.errors[0].message === 'string');
    assert.ok(r.errors[0].message.length > 0);
  });

  test('error has phase field', () => {
    const r = compile('x = @@');
    if (r.success) throw new Error('expected failure');
    assert.ok(r.errors[0].phase === 1 || r.errors[0].phase === 2);
  });

  test('semantic error is phase 2', () => {
    const r = compile('x = bad_fn(1)');
    if (r.success) throw new Error('expected failure');
    assert.equal(r.errors[0].phase, 2);
  });

  test('error message stripped of prefix', () => {
    const r = compile('x = bad_fn(1)');
    if (r.success) throw new Error('expected failure');
    assert.ok(!r.errors[0].message.startsWith('['));
  });
});

describe('math table stakes', () => {
  test('scientific notation', () => {
    assert.equal(ok('x = 1e5').state.expressions.list[0].latex, 'x=100000');
  });

  test('signed exponent', () => {
    assert.equal(ok('x = 1.5e-3').state.expressions.list[0].latex, 'x=0.0015');
  });

  test('a tiny number stays valid latex', () => {
    assert.equal(ok('x = 1e-7').state.expressions.list[0].latex, 'x=1\\cdot10^{-7}');
  });

  test('e is still a variable when no digits follow', () => {
    assert.equal(ok('x = 2e').state.expressions.list[0].latex, 'x=2e');
  });

  test('implicit multiplication by a variable', () => {
    assert.equal(ok('y = 2x').state.expressions.list[0].latex, 'y=2x');
  });

  test('implicit multiplication by a group', () => {
    assert.equal(ok('y = 2(x + 1)').state.expressions.list[0].latex, 'y=2\\left(x+1\\right)');
  });

  test('implicit multiplication by a call', () => {
    ok('y = 3sin(x)');
  });

  test('implicit multiplication binds tighter than addition', () => {
    assert.equal(ok('y = 2x + 1').state.expressions.list[0].latex, 'y=2x+1');
  });

  test('greek letters are identifiers', () => {
    assert.equal(ok('α = 3').state.expressions.list[0].latex, '\\alpha=3');
  });

  test('a greek letter and its ascii name are one variable', () => {
    assert.equal(ok('alpha = 3\nβ = alpha + 1').state.expressions.list[1].latex, '\\beta=\\alpha+1');
  });

  test('text accepts a style block', () => {
    assert.equal(ok('text l = "hi" at (0, 0) as { color red }').state.expressions.list[0].color, '#c74440');
  });

  test('expr blocks still parse', () => {
    ok('r = 0\nexpr {\n  a = 1\n  b = 2\n  a + b\n}');
  });
});

describe('builtins stay in sync', () => {
  test('every highlighted builtin compiles', () => {
    for (const name of BUILTIN_FNS) {
      const r = compile(`y = ${name}(1)`);
      const undef = r.success ? [] : r.errors.filter(e => e.message.includes(`undefined function '${name}'`));
      assert.equal(undef.length, 0, `${name} is highlighted but the analyzer rejects it`);
    }
  });

  test('every builtin has a hover signature', () => {
    for (const name of BUILTIN_FNS) {
      assert.ok(builtinSignature(name), `${name} has no signature`);
    }
  });

  test('every builtin is offered as a completion', () => {
    const labels = new Set(buildCompletions({ Keyword: 1, Snippet: 2, Function: 3 }).map(c => c.label));
    for (const name of BUILTIN_FNS) assert.ok(labels.has(name), `${name} is missing from completions`);
  });
});

describe('formatter', () => {
  const round = (s: string) => formatDsl(formatDsl(s));

  test('normalises operator spacing', () => {
    assert.equal(formatDsl('x=1+2*3'), 'x = 1 + 2 * 3\n');
  });

  test('keeps powers tight', () => {
    assert.equal(formatDsl('y  =  x ^ 2'), 'y = x^2\n');
  });

  test('spaces after commas only', () => {
    assert.equal(formatDsl('p = f( 1 ,2 , 3 )'), 'p = f(1, 2, 3)\n');
  });

  test('keeps implicit multiplication adjacent', () => {
    assert.equal(formatDsl('y=2x+3sin(t)'), 'y = 2x + 3sin(t)\n');
  });

  test('keeps unary minus tight', () => {
    assert.equal(formatDsl('v = x where x>0 else -x'), 'v = x where x > 0 else -x\n');
  });

  test('kwargs stay tight, assignments do not', () => {
    assert.equal(formatDsl('a=slider(0,0,10,step = 2)'), 'a = slider(0, 0, 10, step=2)\n');
  });

  test('indents block bodies', () => {
    assert.equal(formatDsl('expr {\na = 1\na\n}'), 'expr {\n  a = 1\n  a\n}\n');
  });

  test('collapses repeated blank lines', () => {
    assert.equal(formatDsl('\n\nx = 1\n\n\n\ny = 2\n'), 'x = 1\n\ny = 2\n');
  });

  test('preserves comments and strings verbatim', () => {
    const src = 'text l = "a  b // not a comment" at (0, 0) // real comment\n';
    assert.equal(formatDsl(src), src);
  });

  test('leaves an empty file empty', () => {
    assert.equal(formatDsl('   \n\n'), '');
  });

  test('is idempotent on the example file', () => {
    const src = readFileSync(new URL('../../example/demo.dsmx', import.meta.url), 'utf8');
    const once = formatDsl(src);
    assert.equal(round(src), once);
    assert.ok(compile(once).success, 'formatted output must still compile');
  });

  test('keeps the crlf line endings the file arrived with', () => {
    const src = 'a = 1\r\nb  =  2\r\n';
    const once = formatDsl(src);
    assert.equal(once, 'a = 1\r\nb = 2\r\n');
    assert.equal(formatDsl(once), once);
  });

  test('keeps lf endings, and picks the dominant one in a mixed file', () => {
    assert.equal(formatDsl('a = 1\nb  = 2\n'), 'a = 1\nb = 2\n');
    assert.equal(formatDsl('a = 1\r\nb = 2\r\nc = 3\n'), 'a = 1\r\nb = 2\r\nc = 3\r\n');
    assert.equal(formatDsl('a = 1\nb = 2\nc = 3\r\n'), 'a = 1\nb = 2\nc = 3\n');
  });

  test('a crlf file compiles to the same expressions as its lf twin', () => {
    const src = readFileSync(new URL('../../example/demo.dsmx', import.meta.url), 'utf8');
    const crlf = src.replace(/\r?\n/g, '\r\n');
    const formatted = formatDsl(crlf);
    assert.ok(formatted.includes('\r\n'), 'crlf must survive the formatter');
    assert.equal(formatted, formatDsl(formatted));
    assert.equal(formatted.replace(/\r\n/g, '\n'), formatDsl(src));
  });

  test('formatting never changes the compiled output', () => {
    const src = readFileSync(new URL('../../example/demo.dsmx', import.meta.url), 'utf8');
    const before = compile(src);
    const after = compile(formatDsl(src));
    assert.ok(before.success && after.success);
    assert.deepEqual(
      (after as CompileSuccess).state.expressions.list,
      (before as CompileSuccess).state.expressions.list,
    );
  });
});

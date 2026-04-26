/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compile, compileToList } from '../index';
import type { CompileSuccess } from '../index';

function ids(src: string): string[] {
  const list = compileToList(src);
  if (!list) throw new Error(`compile failed for: ${src}`);
  return list.map(e => e.id);
}

function latex(src: string): string[] {
  const list = compileToList(src);
  if (!list) throw new Error(`compile failed for: ${src}`);
  return list.flatMap(e => (e.latex ? [e.latex] : []));
}

function success(src: string): CompileSuccess {
  const r = compile(src);
  if (!r.success) throw new Error(`expected success, got: ${r.errors[0]?.message}`);
  return r;
}

describe('stable expression IDs', () => {
  test('var decl gets name-based id', () => {
    const list = compileToList('x = 3');
    if (!list) throw new Error('compile failed');
    assert.equal(list[0].id, 'x');
  });

  test('point decl gets name-based id', () => {
    assert.equal(ids('point p (1, 2)')[0], 'p');
  });

  test('circle decl gets name-based id', () => {
    assert.equal(ids('circle c = circle((0,0), 1)')[0], 'c');
  });

  test('grid emits two exprs with _h/_v suffix', () => {
    const i = ids('grid g = grid(5, 5)');
    assert.ok(i.includes('g_h'));
    assert.ok(i.includes('g_v'));
  });

  test('duplicate-named decls get _2 suffix', () => {
    const i = ids('x = 1\nx = 2');
    assert.ok(i.includes('x'));
    assert.ok(i.includes('x_2'));
  });

  test('adding a leading statement does not shift ids of later statements', () => {
    const before = ids('a = 1\nb = 2');
    const after  = ids('z = 0\na = 1\nb = 2');
    assert.equal(before[0], 'a');
    assert.equal(before[1], 'b');
    assert.equal(after[1], 'a');
    assert.equal(after[2], 'b');
  });
});

describe('codegen — latex output', () => {
  test('var decl', () => {
    assert.deepEqual(latex('x = 3'), ['x=3']);
  });

  test('alias decl referenced', () => {
    assert.deepEqual(latex('alias k = 2\nx = k + 1'), ['k=2', 'x=k+1']);
  });

  test('fn inlined at call site', () => {
    const l = latex('fn f(a) = a^2\ny = f(3)');
    assert.ok(l.some(s => s.includes('9')), `expected constant-folded 3^2=9, got: ${l}`);
  });

  test('slider produces correct latex', () => {
    const list = compileToList('a = slider(0, 0, 10)');
    if (!list) throw new Error('compile failed');
    assert.ok(list[0].latex?.startsWith('a='));
    assert.ok(list[0].slider);
  });

  test('domain restriction', () => {
    const l = latex('y = x^2 domain x > 0');
    assert.ok(l[0].includes('\\left\\{'));
  });

  test('circle latex form', () => {
    const l = latex('circle c = circle((0,0), 2)');
    assert.ok(l[0].includes('^{2}'));
  });

  test('segment latex', () => {
    const l = latex('segment s = (0,0) -> (1,1)');
    assert.ok(l[0].startsWith('\\left['));
  });

  test('curve parametric', () => {
    const l = latex('curve r (t in 0..6.28) { (cos(t), sin(t)) }');
    assert.ok(l[0].includes('\\cos'));
  });

  test('region inequality', () => {
    const l = latex('region r = y > x^2');
    assert.ok(l[0].includes('>'));
  });

  test('group emits folder', () => {
    const list = compileToList('group g as "Motion"');
    if (!list) throw new Error('compile failed');
    assert.equal(list[0].type, 'folder');
    assert.equal(list[0].title, 'Motion');
  });
});

describe('codegen — nameToLatex', () => {
  test('single char', () => assert.deepEqual(latex('a = 1'), ['a=1']));
  test('multi char subscript', () => assert.deepEqual(latex('ab = 1'), ['a_{b}=1']));
  test('underscore subscript', () => assert.deepEqual(latex('x_1 = 1'), ['x_{1}=1']));
  test('greek', () => assert.ok(latex('alpha = 1')[0].includes('\\alpha')));
});

describe('dead code warnings', () => {
  test('unused fn warns', () => {
    const r = success('fn helper(a) = a * 2\npoint p (1, 2)');
    assert.ok(r.warnings.some(w => w.message.includes('never used')));
  });

  test('unused alias warns', () => {
    const r = success('alias k = 42\npoint p (1, 2)');
    assert.ok(r.warnings.some(w => w.message.includes('never used')));
  });

  test('used fn no unused warn', () => {
    const r = success('fn f(a) = a^2\nx = f(3)');
    assert.ok(!r.warnings.some(w => w.message.includes("'f'") && w.message.includes('never used')));
  });
});

describe('dead code elimination — optimizer', () => {
  test('unused alias is stripped from output', () => {
    const list = compileToList('alias k = 42\npoint p (1, 2)');
    if (!list) throw new Error('compile failed');
    assert.ok(!list.some(e => e.id === 'k'), 'unused alias should be eliminated');
  });

  test('used alias is kept in output', () => {
    const list = compileToList('alias k = 42\nx = k + 1');
    if (!list) throw new Error('compile failed');
    assert.ok(list.some(e => e.id === 'k'), 'used alias should be retained');
  });

  test('unused alias elimination does not affect other exprs', () => {
    const list = compileToList('alias unused = 1\nx = 5');
    if (!list) throw new Error('compile failed');
    assert.ok(list.some(e => e.id === 'x'));
  });
});

describe('codegen — snapshot', () => {
  test('point with style', () => {
    const l = latex('point p (3, 4) as { color red pointSize 10 }');
    assert.ok(l[0].includes('3') && l[0].includes('4'));
  });

  test('polygon latex', () => {
    const l = latex('polygon tri = [(0,0), (1,0), (0,1)]');
    assert.ok(l[0].includes('\\operatorname{polygon}'));
  });

  test('wave decl emits parametric tuple', () => {
    const l = latex('wave w = wave(freq=2, amp=1)');
    assert.ok(l[0].includes('\\sin'));
  });

  test('spiral decl emits parametric tuple', () => {
    const l = latex('spiral s = spiral(turns=3, spacing=0.5)');
    assert.ok(l[0].includes('\\cos') && l[0].includes('\\sin'));
  });

  test('fn inlining: multi-param', () => {
    const l = latex('fn add(a, b) = a + b\nx = add(2, 3)');
    assert.ok(l.some(s => s.includes('5')), `expected constant-folded 2+3=5, got: ${l}`);
  });

  test('piecewise branches', () => {
    const l = latex('z = { x > 0: x^2, x < 0: -x, else: 0 }');
    assert.ok(l[0].includes('\\left\\{'));
    assert.ok(l[0].includes('>'));
    assert.ok(l[0].includes('<'));
  });

  test('domain restriction includes brace', () => {
    const l = latex('y = x^2 domain x > 0');
    assert.match(l[0], /\\left\\{x>0\\right\\}/);
  });

  test('conditional where/else', () => {
    const l = latex('v = x^2 where x > 0 else -x');
    assert.ok(l[0].includes('\\left\\{'));
  });

  test('for-expr list comprehension', () => {
    const l = latex('pts = (cos(t), sin(t)) for t in 0..6.28');
    assert.ok(l[0].includes('\\cos') || l[0].includes('\\left['));
  });

  test('text decl emits label', () => {
    const list = compileToList('text lbl = "hello" at (1, 2)');
    if (!list) throw new Error('compile failed');
    assert.equal(list[0].label, 'hello');
    assert.equal(list[0].showLabel, true);
  });

  test('slider min/max wired correctly', () => {
    const list = compileToList('a = slider(0, -5, 5)');
    if (!list) throw new Error('compile failed');
    assert.equal(list[0].slider?.min, '-5');
    assert.equal(list[0].slider?.max, '5');
  });

  test('line slope-intercept latex', () => {
    const l = latex('line l = slope(2), intercept(3)');
    assert.ok(l[0].startsWith('y='));
  });

  test('segment endpoint coords', () => {
    const l = latex('segment s = (1,2) -> (3,4)');
    assert.ok(l[0].includes('1') && l[0].includes('2') && l[0].includes('3') && l[0].includes('4'));
  });
});

describe('compiler — error shape', () => {
  test('syntax error has phase 1', () => {
    const r = compile('x = @@');
    if (r.success) throw new Error('expected failure');
    assert.equal(r.errors[0].phase, 1);
  });

  test('semantic error has phase 2', () => {
    const r = compile('x = bad_fn(1)');
    if (r.success) throw new Error('expected failure');
    assert.equal(r.errors[0].phase, 2);
  });

  test('error message is human-readable (no raw prefix)', () => {
    const r = compile('x = bad_fn(1)');
    if (r.success) throw new Error('expected failure');
    assert.ok(!r.errors[0].message.startsWith('['));
  });

  test('arity mismatch error', () => {
    const r = compile('fn f(a) = a\nx = f(1, 2)');
    if (r.success) throw new Error('expected failure');
    assert.ok(r.errors[0].message.includes('argument'));
  });
});

describe('optimizer — constant folding', () => {
  test('folds integer arithmetic', () => {
    const l = latex('x = 2 + 3 * 4');
    assert.deepEqual(l, ['x=14']);
  });

  test('folds unary negation of literal', () => {
    const l = latex('x = -5');
    assert.deepEqual(l, ['x=-5']);
  });

  test('double negation cancels via unary chain', () => {
    const l = latex('fn f(a) = -(-a)\nx = f(3)');
    assert.ok(l.some(s => s.includes('3')));
  });

  test('multiply by one simplifies', () => {
    const l = latex('fn f(a) = a * 1\nx = f(7)');
    assert.ok(l.some(s => s.includes('7')));
  });
});

/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../index';
import { decompile, latexToDsl } from '../compiler/decompile';

describe('latex back to a DSL expression', () => {
  const cases: [string, string][] = [
    ['3', '3'],
    ['a\\cdot 2+1', 'a * 2 + 1'],
    ['\\frac{a+1}{2}', '(a + 1) / 2'],
    ['a^{2}', 'a ^ 2'],
    ['\\sin\\left(a\\right)+\\cos\\left(2\\cdot a\\right)', 'sin(a) + cos(2 * a)'],
    ['\\alpha', 'alpha'],
    ['l_{ongname}', 'longname'],
    ['x_{2}', 'x_2'],
    ['2x+1', '2 * x + 1'],
    ['\\left(1,2\\right)', '(1, 2)'],
    ['y>x^{2}', 'y > x ^ 2'],
    ['a-\\left(b-c\\right)', 'a - (b - c)'],
    ['\\frac{a}{b\\cdot c}', 'a / (b * c)'],
  ];

  for (const [latex, dsl] of cases) {
    test(`${latex} -> ${dsl}`, () => assert.equal(latexToDsl(latex), dsl));
  }

  test('refuses latex the DSL has no words for', () => {
    assert.equal(latexToDsl('\\int_{0}^{1}x'), null);
    assert.equal(latexToDsl('\\sum'), null);
    assert.equal(latexToDsl('a+'), null);
  });
});

describe('a whole statement', () => {
  test('a plain variable', () => {
    assert.equal(decompile({ type: 'expression', id: 'a', latex: 'a=3' }, 'a'), 'a = 3');
  });

  test('a slider keeps its bounds', () => {
    const out = decompile(
      { type: 'expression', id: 's', latex: 's=1', slider: { min: '0', max: '10' } },
      's',
    );
    assert.equal(out, 's = slider(1, 0, 10)');
  });

  test('a point', () => {
    assert.equal(
      decompile({ type: 'expression', id: 'p', latex: 'p=\\left(1,2\\right)', label: 'p' }, 'p'),
      'point p = (1, 2)',
    );
  });

  test('a label that is not the name is text', () => {
    assert.equal(
      decompile({ type: 'expression', id: 'l', latex: 'l=\\left(1,2\\right)', label: 'hi' }, 'l'),
      'text l = text("hi", at=(1, 2))',
    );
  });

  test('a region', () => {
    assert.equal(
      decompile({ type: 'expression', id: 'r', latex: 'y>x^{2}' }, 'r'),
      'region r = y > x ^ 2',
    );
  });

  test('a function', () => {
    assert.equal(
      decompile({ type: 'expression', id: 'f', latex: 'f\\left(x,y\\right)=x\\cdot y+1' }, 'f'),
      'fn f(x, y) = x * y + 1',
    );
  });

  test('a curve carries its domain', () => {
    assert.equal(
      decompile({
        type: 'expression', id: 'c',
        latex: '\\left(\\cos\\left(t\\right),\\sin\\left(t\\right)\\right)',
        parametricDomain: { min: '0', max: '6.28' },
      }, 'c'),
      'curve c = curve(t -> (cos(t), sin(t)), 0..6.28)',
    );
  });

  test('a polygon', () => {
    assert.equal(
      decompile({
        type: 'expression', id: 't',
        latex: '\\operatorname{polygon}\\left(\\left(0,0\\right),\\left(1,0\\right)\\right)',
      }, 't'),
      'polygon t = polygon([(0, 0), (1, 0)])',
    );
  });

  test('a segment', () => {
    assert.equal(
      decompile({
        type: 'expression', id: 's',
        latex: '\\left[\\left(0,0\\right),\\left(1,1\\right)\\right]',
      }, 's'),
      'segment s = segment((0, 0), (1, 1))',
    );
  });

  test('a folder', () => {
    assert.equal(decompile({ type: 'folder', id: 'g', title: 'My Folder' }, 'g'),
      'group g = group("My Folder")');
  });

  test('leaves an expression it cannot express alone', () => {
    assert.equal(decompile({ type: 'expression', id: 'x', latex: '\\int x' }, 'x'), null);
    assert.equal(decompile({ type: 'expression', id: 'x' }, 'x'), null);
  });
});

describe('round trip', () => {
  // a statement written by the decompiler must compile to the same graph
  const sources = [
    'a = 3',
    'b = 2 * 3 + 1',
    'c = (1 + 2) / 4',
    'd = 2 ^ 3',
    'e = sin(1) + cos(2)',
    'alpha = 1',
    'longname = 5',
    'fn f(x, y) = x * y + 1',
    'point p = (1, 2)',
    'segment s = segment((0,0), (1,1))',
    'polygon tri = polygon([(0,0), (1,0), (0,1)])',
    'region r = y > x ^ 2',
    'curve cu = curve(t -> (cos(t), sin(t)), 0..6.28)',
    'text lbl = text("hi", at=(1, 2))',
    'sl = slider(1, 0, 10)',
  ];

  for (const src of sources) {
    test(src, () => {
      const first = compile(src);
      assert.equal(first.success, true, `source did not compile: ${src}`);
      if (!first.success) return;

      const expr = first.state.expressions.list[0];
      const back = decompile(expr, expr.id);
      assert.ok(back, `no DSL for ${expr.latex}`);

      const second = compile(back!);
      assert.equal(second.success, true, `decompiled did not compile: ${back}`);
      if (!second.success) return;

      assert.equal(
        second.state.expressions.list[0].latex,
        expr.latex,
        `latex changed: ${back}`,
      );
    });
  }

  test('a second trip changes nothing more', () => {
    const first = compile('b = 2 * 3 + 1');
    if (!first.success) throw new Error('no');
    const e1 = first.state.expressions.list[0];
    const once = decompile(e1, e1.id)!;

    const second = compile(once);
    if (!second.success) throw new Error('no');
    const e2 = second.state.expressions.list[0];
    assert.equal(decompile(e2, e2.id), once);
  });
});

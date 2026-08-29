
import { describe, it, expect } from 'bun:test';
import { tokenize } from '../compiler/lexer';
import { parse } from '../compiler/parser';
import { analyze } from '../compiler/analyze';
import { optimize, substituteExpr } from '../compiler/optimizer';
import { codegenWithSourceMap } from '../compiler/codegen';
import { toTex } from '../compiler/tex';
import type { Program } from '../compiler/types';

function deepFreeze<T>(value: T, seen = new Set<unknown>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v, seen);
  return Object.freeze(value);
}

const SOURCES: Record<string, string> = {
  'arithmetic folding': `
a = 1 + 2 * 3
b = 0 + a
c = a * 1
d = a ^ 1
e = --a
f = a / 1
g = 0 * a
`,
  'fn inlining': `
fn sq(x) = x^2
fn add(a, b) = a + b
fn outer(x) = add(sq(x), sq(x + 1))
v = outer(3)
w = sq(w0)
w0 = 2
`,
  'geometry and styling': `
n = 4
point p (n, 2) as { color red pointSize 12 }
circle c = circle((0, 0), n + 1)
line l = slope(2), intercept(1)
line l2 = 2*x + y = 4
segment s = (0,0) -> (1, n)
polygon tri = [(0,0), (1,0), (0,1)]
text lbl = "hello" at (1, 2)
group g as "My Folder"
`,
  'curves, ranges and comprehensions': `
k = 2
curve ring (t in 0..6.28) { (cos(t)*k, sin(t)) }
pts = (cos(t), sin(t)) for t in 0..6.28
region r = y > x^2 as { color blue opacity 0.3 }
lst = [0..10]
`,
  'conditionals and blocks': `
q = x^2 where x > 0 else -x^2
z = { x > 0: x^2, x < 0: -x, else: 0 }
`,
  'unused alias and debug': `
alias unused = 1 + 1
alias used = 3 * 3
m = used
debug m + 1
`,
  'animation and 3d': `
s = slider(1, 0, 10)
time tt = 0..10 every 2
camera cam = (30 + 15, 45)
wave wv = freq(2), amp(1 + 1)
spiral sp = turns(3), spacing(0.5)
grid gr = cols(2 + 1), rows(4)
`,
};

describe('ast is not mutated after parsing', () => {
  for (const [label, src] of Object.entries(SOURCES)) {
    it(`survives the whole pipeline frozen — ${label}`, () => {
      const ast = deepFreeze(parse(tokenize(src)).ast);

      expect(analyze(ast)).toEqual([]);

      const notes: Parameters<typeof optimize>[1] = [];
      const optimized = optimize(ast, notes);

      // the optimizer's own output is reused too, so it must not be written to either
      deepFreeze(optimized);
      expect(() => codegenWithSourceMap(optimized)).not.toThrow();
      expect(() => toTex(optimized)).not.toThrow();
    });
  }

  it('leaves the parsed tree deep-equal to a fresh parse', () => {
    for (const src of Object.values(SOURCES)) {
      const ast = parse(tokenize(src)).ast;
      const pristine: Program = parse(tokenize(src)).ast;

      analyze(ast);
      const optimized = optimize(ast, []);
      codegenWithSourceMap(optimized);

      expect(ast).toEqual(pristine);
    }
  });

  it('substituteExpr does not write into the body it copies', () => {
    const ast = deepFreeze(parse(tokenize('fn f(x) = x^2 + x\nv = f(3)\n')).ast);
    const fn = ast.body.find(s => s.type === 'FnDecl');
    if (fn?.type !== 'FnDecl') throw new Error('no fn');
    const subst = new Map([['x', { type: 'NumLit' as const, value: 3, pos: fn.pos }]]);
    expect(() => substituteExpr(fn.body, subst)).not.toThrow();
  });

  it('an optimized statement that moved nothing is the identical node', () => {
    const ast = parse(tokenize('point p (1, 2)\ntext lbl = "hi" at (0, 0)\n')).ast;
    const optimized = optimize(ast, []);
    expect(optimized.body[0]).toBe(ast.body[0]);
    expect(optimized.body[1]).toBe(ast.body[1]);
  });
});

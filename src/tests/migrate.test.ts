/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { migrateDsl, needsMigration } from '../compiler/migrate';
import { compile } from '../compile';

const LEGACY = `// a file in the older grammar
alias hyp_r = 3
point p (1, 2)
circle c = circle((0, 0), 3)
circle c2 { center (1, 1)  radius 2 }
line l = slope(2), intercept(1)
line l2 = 2*x + y = 4
segment s = (0,0) -> (1,1)
polygon tri = [(0,0), (1,0), (0,1)]

curve ring (t in 0..6.28) { (cos(t), sin(t)) }
pts = (cos(t), sin(t)) for t in 0..6.28
lst = [1, 2 ... 9]
v = x^2 where x > 0 else -x^2
y2 = x^2 domain x > 0

text lbl = "hello" at (1, 2)   // a label
group g as "My Folder"
time T = 0..6.28 period 4000
camera cam = azimuth(0.6), elevation(0.4)
a = slider(3, 0, 10, step=0.1, speed=1, loop)

point p3 (0, 0) as { color red pointSize 12 }
curve ring2 (u in 0..1) { (u, u) } as gradient(blue, red)
`;

describe('the codemod', () => {
  test('recognises every legacy form it rewrites', () => {
    assert.equal(needsMigration(LEGACY), true);
  });

  test('what it writes compiles', () => {
    const out = migrateDsl(LEGACY);
    const r = compile(out);
    assert.equal(r.success, true, r.success ? '' : r.errors[0]?.message);
  });

  test('what it writes is already current', () => {
    const out = migrateDsl(LEGACY);
    assert.equal(needsMigration(out), false);
    assert.equal(migrateDsl(out), out);
  });

  test('comments and blank lines survive', () => {
    const out = migrateDsl(LEGACY);
    assert.match(out, /^\/\/ a file in the older grammar$/m);
    assert.match(out, /\/\/ a label$/m);
    assert.match(out, /\n\n/);
  });

  test('a file already in the current grammar is left alone', () => {
    const src = 'point p = (1, 2)\ncircle c = circle(center=(0, 0), radius=3)\n';
    assert.equal(needsMigration(src), false);
    assert.equal(migrateDsl(src), src);
  });

  test('a line it does not recognise is left as it was found', () => {
    const src = 'point p (1, 2)\nnot a statement at all!!\n';
    assert.match(migrateDsl(src), /^not a statement at all!!$/m);
  });
});

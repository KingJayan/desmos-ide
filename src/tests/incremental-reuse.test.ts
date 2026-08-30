
import { describe, it, expect } from 'bun:test';
import { compile } from '../compile';
import { createIncrementalCompiler } from '../incremental';
import { createParseCache, parseIncremental } from '../compiler/incremental-parse';

const BASE = `fn sq(x) = x^2
fn area(r) = 3.14159 * sq(r)
n = slider(2, 0, 10)
a = area(n) + 0
b = sq(n) * 1
point p = (a, b)
circle c = circle(center=(0, 0), radius=a + 1)
curve ring = curve(t -> (cos(t)*a, sin(t)*b), 0..6.28)
region r2 = y > x^2
polygon tri = polygon([(0,0), (1,0), (0,1)])
text lbl = text("hi", at=(a, b))
group g = group("Folder")
`;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function mutate(src: string, rnd: () => number): string {
  const lines = src.split('\n');
  const i = Math.floor(rnd() * lines.length);
  const line = lines[i];
  const kind = rnd();
  if (kind < 0.3) lines.splice(i, 0, rnd() < 0.5 ? '' : `// note ${Math.floor(rnd() * 99)}`);
  else if (kind < 0.5 && lines.length > 2) lines.splice(i, 1);
  else if (kind < 0.75 && line.length > 0) {
    const at = Math.floor(rnd() * line.length);
    lines[i] = line.slice(0, at) + line.slice(at + 1);
  } else {
    const at = Math.floor(rnd() * (line.length + 1));
    lines[i] = line.slice(0, at) + '1' + line.slice(at);
  }
  return lines.join('\n');
}

describe('createIncrementalCompiler', () => {
  it('agrees with a full compile across a run of edits', () => {
    const inc = createIncrementalCompiler();
    const edits = [
      BASE,
      BASE.replace('fn sq(x) = x^2', 'fn sq(x) = x^3'),
      BASE.replace('point p = (a, b)\n', ''),
      `${BASE}d = a + b\n`,
      BASE.replace('  (cos(t)*a, sin(t)*b)\n', '  (cos(t), sin(t)*a)\n  '),
      BASE.replace('b = sq(n) * 1', 'b = sq(n) + undeclared'),
      BASE.replace('n = slider(2, 0, 10)', 'n = slider('),
      BASE,
      '',
      'z = 1',
      BASE,
    ];
    for (const src of edits) expect(inc(src)).toEqual(compile(src));
  });

  it('agrees with a full compile when a prelude is in play', () => {
    const inc = createIncrementalCompiler();
    const opts = { prelude: 'fn double(x) = 2x\ntwo = 2\n', available: ['demo'] };
    for (const src of [BASE, `${BASE}d = double(4)\n`, `use "demo"\n${BASE}`, BASE]) {
      expect(inc(src, opts)).toEqual(compile(src, opts));
    }
  });

  it('agrees with a full compile under 400 random edits', () => {
    const rnd = lcg(20250818);
    const inc = createIncrementalCompiler();
    let src = BASE;
    for (let i = 0; i < 400; i++) {
      src = mutate(src, rnd);
      expect(inc(src)).toEqual(compile(src));
    }
  });

  it('holds a camera edit against every project call below it', () => {
    const inc = createIncrementalCompiler();
    const src = (az: string) => `camera cam = (${az}, 45)\nq = project(1, 2, 3)\nw = project(4, 5, 6)\n`;
    for (const az of ['30', '31', '30', '99']) {
      expect(inc(src(az))).toEqual(compile(src(az)));
    }
  });

  it('holds a duplicate name, where an id carries a counter', () => {
    const inc = createIncrementalCompiler();
    for (const v of ['1', '2', '1']) {
      const src = `dup = ${v}\ndup = 5\ndup = 6\n`;
      expect(inc(src)).toEqual(compile(src));
    }
  });
});

describe('the caches are used', () => {
  it('hands back the identical statement node for an untouched line', () => {
    const cache = createParseCache();
    const src = 'a = 1\nb = 2\nc = 3\n';
    const first = parseIncremental(src, cache);
    const second = parseIncremental('a = 1\nb = 22\nc = 3\n', cache);

    expect(second.ast.body[0]).toBe(first.ast.body[0]);
    expect(second.ast.body[1]).not.toBe(first.ast.body[1]);
  });

  it('edits one line and regenerates only that expression', () => {
    const inc = createIncrementalCompiler();
    const lines = Array.from({ length: 60 }, (_, i) => `v${i} = ${i} + 0`);
    const first = inc(lines.join('\n') + '\n');
    if (!first.success) throw new Error('setup does not compile');

    lines[30] = 'v30 = 30 + 2';
    const edited = lines.join('\n') + '\n';
    const out = inc(edited);
    expect(out).toEqual(compile(edited));
    if (!out.success) throw new Error('edit does not compile');

    // a replayed emit is the very same object; only the edited line is built again
    const before = first.state.expressions.list;
    const after = out.state.expressions.list;
    const rebuilt = after.filter((e, i) => e !== before[i]).map(e => e.id);
    expect(rebuilt).toEqual(['v30']);
    // and every other line still reports the fold it made
    expect(out.optimizations).toHaveLength(60);
  });

  it('rebuilds every call site when a fn body changes', () => {
    const inc = createIncrementalCompiler();
    const src = (body: string) => `fn f(x) = ${body}\ng = 1 + 0\nu = f(2)\nw = f(3)\n`;
    const first = inc(src('x^2'));
    const out = inc(src('x^3'));
    expect(out).toEqual(compile(src('x^3')));
    if (!first.success || !out.success) throw new Error('does not compile');

    const before = first.state.expressions.list;
    const after = out.state.expressions.list;
    const rebuilt = after.filter((e, i) => e !== before[i]).map(e => e.id);
    expect(rebuilt).toEqual(['f', 'u', 'w']);
  });
});

// ── Compiler demo ──────────────────────────────────────────────────────────────
// Run:  npx ts-node src/demo.ts

import { compile } from './index';

// ── Example 1: Animated orbit ─────────────────────────────────────────────────

const ORBIT = `
// Animated parametric orbit
let t = time(0, 10)

fn wave(x) = sin(x + t)

circle orbit {
  center: (0, 0)
  radius: 3
}

circle moving {
  center: (cos(t), sin(t))
  radius: 1
}

points trail = map(i in [0...100]) {
  (cos(t + i/10), sin(t + i/10))
}
`;

// ── Example 2: Static geometry ────────────────────────────────────────────────

const GEOMETRY = `
let r = 5

point origin {
  center: (0, 0)
}

circle big {
  center: (0, 0)
  radius: r
}

line diagonal {
  slope: 1
  intercept: 0
}

line horizontal {
  y: 2
}
`;

// ── Example 3: Function inlining ──────────────────────────────────────────────

const INLINING = `
// f is inlined at every call site — no function def emitted
fn f(x) = x^2 + 2*x + 1
fn g(x) = f(x) * 3

let a = g(4)
let b = f(0)
`;

// ── Run ────────────────────────────────────────────────────────────────────────

const EXAMPLES: [string, string][] = [
  ['Animated orbit',    ORBIT],
  ['Static geometry',   GEOMETRY],
  ['Function inlining', INLINING],
];

for (const [title, src] of EXAMPLES) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));

  const result = compile(src.trim());

  if (!result.success) {
    result.errors.forEach(e => console.error(`  ✗ Error: ${e.error}`));
    continue;
  }

  console.log(`  ✓ Compiled to ${result.state.expressions.list.length} expression(s)\n`);

  for (const expr of result.state.expressions.list) {
    const sliderNote = expr.slider
      ? `  [slider min=${expr.slider.min} max=${expr.slider.max} playing=${expr.slider.isPlaying}]`
      : '';
    console.log(`  [${expr.id}] ${expr.latex ?? ''}${sliderNote}`);
    if (expr.color)       console.log(`       color: ${expr.color}`);
    if (expr.fill)        console.log(`       fill: true (opacity ${expr.fillOpacity})`);
    if (expr.points)      console.log(`       points: true`);
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log('  Full Desmos state (example 1)');
console.log('═'.repeat(60));
const r = compile(ORBIT.trim());
if (r.success) {
  console.log(JSON.stringify(r.state, null, 2));
}

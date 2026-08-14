// compiler demo
// run:  bun demo

import { compile } from './index';

const GEOMETRY = `
point origin (0, 0) as { color blue pointSize 10 }
point p (3, 4) as { color red }
circle c {
  center (0, 0)
  radius 5
}
segment s = (0,0) -> (3,4) as { color green lineWidth 2 }
polygon tri = [(0,0),(3,0),(0,4)] as { color orange opacity 0.3 }
`;

const FUNCTIONS = `
fn hyp(x, y) = sqrt(x^2 + y^2)
alias dist = hyp(3, 4)
a = slider(3, 0, 10, step=0.1, speed=1, loop)
b = 4
alias r = hyp(a, b)
`;

const GENERATORS = `
pts = map(i -> (cos(i), sin(i)), 0..6.28 step 0.1)
curve orbit (t in 0..6.28) { (2*cos(t), sin(t)) }
`;

const CONDITIONALS = `
y = x^2 where x > 0 else -x
v = if x > 0 then x^2 else -x
z = { x > 0: x^2, x < 0: -x, else: 0 }
w = x^2 domain x > -3
`;

const EXPR_BLOCK = `
expr {
  cx = cos(t)
  cy = sin(t)
  (2*cx, cy)
}
`;

const EXAMPLES: Array<[string, string]> = [
  ['Geometry',     GEOMETRY],
  ['Functions',    FUNCTIONS],
  ['Generators',   GENERATORS],
  ['Conditionals', CONDITIONALS],
  ['Expr block',   EXPR_BLOCK],
];

for (const [title, src] of EXAMPLES) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));

  const result = compile(src.trim());

  if (!result.success) {
    result.errors.forEach(e => console.error(`  ✗ [phase ${e.phase}] ${e.error}`));
    continue;
  }

  if (result.warnings.length) {
    result.warnings.forEach(w => console.warn(`  ⚠ ${w.message}`));
  }

  console.log(`  ✓ ${result.state.expressions.list.length} expression(s)\n`);

  for (const expr of result.state.expressions.list) {
    const sliderNote = expr.slider
      ? `  [slider min=${expr.slider.min} max=${expr.slider.max} step=${expr.slider.step ?? '-'} loop=${expr.slider.loopMode ?? 'off'}]`
      : '';
    console.log(`  [${expr.id}] ${expr.latex ?? '(folder)'}${sliderNote}`);
    if (expr.color)      console.log(`       color: ${expr.color}`);
    if (expr.fill)       console.log(`       fill: true (opacity ${expr.fillOpacity})`);
  }
}

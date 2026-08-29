// desc of the language

import { BUILTINS } from './builtins';
import { DESMOS_NAMED } from './codegen';

export interface SyntaxForm {
  title: string;
  keywords: readonly string[];
  code: readonly string[];
  note?: string;
}

/** style props `as { ... }` accepts */
export const STYLE_PROPS = [
  'color', 'gradient', 'opacity', 'fill', 'pointSize', 'lineWidth', 'lineOpacity',
] as const;

export const SYNTAX_FORMS: readonly SyntaxForm[] = [
  {
    title: 'One statement shape',
    keywords: [],
    code: [
      'x = 3',
      'point p = (1, 2)',
      'circle c = circle(center=(0, 0), radius=3)',
    ],
    note: 'Every statement reads `[kind] name = expression [where condition] [as { ... }]`. The kind in front is a type annotation. It is optional wherever the constructor already says what is built, and it is checked against the constructor when both are written.',
  },
  {
    title: 'Variables and sliders',
    keywords: [],
    code: [
      'x = 3',
      'a = slider(3, 0, 10)                       // slider(value, min, max)',
      'b = slider(3, 0, 10, step=0.1, loop=true)  // step=, speed=, loop= kwargs',
    ],
  },
  {
    title: 'Functions',
    keywords: ['fn'],
    code: [
      'fn f(a, b) = a + b',
      'fn hyp(x, y) = sqrt(x^2 + y^2)',
    ],
    note: 'Functions are inlined at every call site. There is no recursion.',
  },
  {
    title: 'Plugins',
    keywords: ['use'],
    code: ['use "starfield"'],
    note: 'Names a plugin this file needs. The file does not compile without it.',
  },
  {
    title: 'Geometry',
    keywords: ['point', 'circle', 'line', 'segment', 'polygon'],
    code: [
      'point p = (1, 2)',
      'circle c = circle(center=(0, 0), radius=3)',
      'line l = line(slope=2, intercept=1)',
      'line l2 = 2x + y == 4                      // standard form',
      'segment s = segment((0,0), (1,1))',
      'polygon tri = polygon([(0,0), (1,0), (0,1)])',
    ],
  },
  {
    title: 'Curves, lists and regions',
    keywords: ['curve', 'region', 'for', 'in'],
    code: [
      'curve ring = curve(t -> (cos(t), sin(t)), 0..6.28)',
      'pts = [(cos(t), sin(t)) for t in 0..6.28 step 0.1]',
      'squares = [i^2 for i in 1..10]',
      'evens = map(i -> 2i, 1..10)',
      'corners = [(0,0), (1,0), (1,1)]',
      'region above = y > x^2',
    ],
    note: 'A range is written a..b, with an optional `step s`. A comprehension is always bracketed and always produces a list.',
  },
  {
    title: 'Conditionals',
    keywords: ['if', 'then', 'else'],
    code: [
      'v = if x > 0 then x^2 else -x',
      'z = { x > 0: x^2, x < 0: -x, else: 0 }',
    ],
    note: 'A choice is if/then/else. Braces hold a record, so a piecewise reads the same way as a style block.',
  },
  {
    title: 'Domain restriction',
    keywords: ['where'],
    code: ['y = x^2 where x > 0'],
    note: 'Adds a {x>0} filter to the Desmos expression. `where` restricts, `if` chooses.',
  },
  {
    title: 'Local bindings',
    keywords: ['expr'],
    code: [
      'p = expr {',
      '  cx = cos(t)',
      '  cy = sin(t)',
      '  (2cx, cy)',
      '}',
    ],
    note: 'The body is the same grammar as a file. The bindings are inlined at compile time and the last expression is the result.',
  },
  {
    title: 'Compile-time checks',
    keywords: ['debug'],
    code: ['debug hyp(a, b)'],
    note: 'Emits nothing to the graph. Use it to check that a name resolves.',
  },
  {
    title: 'Text and folders',
    keywords: ['text', 'group'],
    code: [
      'text lbl = text("hello", at=(1, 2))',
      'group g = group("My Folder")',
    ],
  },
  {
    title: 'Built-in generators',
    keywords: ['spiral', 'wave', 'grid'],
    code: [
      'spiral coil = spiral(turns=5, spacing=0.2)   // + cX, cY, rotate',
      'wave w = wave(freq=2, amp=1, phase=0)        // + cX, cY, xMin, xMax',
      'grid mesh = grid(10, 10)                     // + xMin, xMax, yMin, yMax',
    ],
  },
  {
    title: 'The clock',
    keywords: ['time'],
    code: [
      'time T = time(0..6.28, period=4000)   // period is milliseconds for one sweep',
      '// time T = time(0..1, mode=mirror)   // mirror turns around instead of jumping back',
    ],
    note: 'One clock per file. It drives the timeline bar under the graph, and it is an ordinary variable everywhere else.',
  },
  {
    title: '3D projection',
    keywords: ['camera'],
    code: [
      'time T = time(0..1)',
      'camera cam = camera(azimuth=6.28T, elevation=0.5)',
      'corner = project(1, 1, 2)      // project(x, y, z); z defaults to 0',
    ],
    note: 'The camera angles are ordinary expressions, so animating one turns the scene.',
  },
  {
    title: 'Styling',
    keywords: ['as'],
    code: [
      'point p2 = (0, 0) as { color: red, pointSize: 12 }',
      'region r2 = y < x as { color: blue, opacity: 0.3, fill: true }',
      'curve unit = curve(t -> (cos(t), sin(t)), 0..6.28) as { gradient: gradient(blue, red) }',
    ],
    note: 'A style block is a record, the same shape as a piecewise. Every value is a full expression, so `opacity: a/2` works.',
  },
  {
    title: 'Comments',
    keywords: [],
    code: [
      '// a line comment',
      '/* a block comment,',
      '   over as many lines as you like */',
    ],
  },
];

function fence(form: SyntaxForm): string {
  const parts = [`### ${form.title}`, '```dsmx', ...form.code, '```'];
  if (form.note) parts.push(form.note);
  return parts.join('\n');
}

function builtinSection(): string {
  const lines = BUILTINS.map(b => `- \`${b.signature}\`${b.doc ? ` — ${b.doc}` : ''}`);
  return ['### Built-in functions', ...lines].join('\n');
}

function styleSection(): string {
  return [
    '### Style properties and colors',
    `Properties: ${STYLE_PROPS.join(', ')}.`,
    `Named colors: ${Object.keys(DESMOS_NAMED).join(', ')}. Any other color comes from \`rgb()\` or \`hsv()\`.`,
  ].join('\n');
}

/** whole syntax reference as md */
export function syntaxReference(): string {
  return [...SYNTAX_FORMS.map(fence), styleSection(), builtinSection()].join('\n\n');
}

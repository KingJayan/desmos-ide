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
    title: 'Variables and sliders',
    keywords: [],
    code: [
      'x = 3',
      'a = slider(3, 0, 10)                    // slider(value, min, max)',
      'b = slider(3, 0, 10, step=0.1, loop)    // step=, speed= kwargs; loop auto-plays',
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
    title: 'Aliases',
    keywords: ['alias'],
    code: ['alias hyp_r = hyp(a, b)'],
    note: 'An alias is the same as an assignment, with a name that says what it holds.',
  },
  {
    title: 'Geometry',
    keywords: ['point', 'circle', 'line', 'segment', 'polygon'],
    code: [
      'point p (1, 2)',
      'circle c = circle((0, 0), 3)',
      'circle c2 { center (0, 0)  radius 3 }   // block form',
      'line l = slope(2), intercept(1)',
      'line l2 = 2*x + y = 4                   // standard form',
      'segment s = (0,0) -> (1,1)',
      'polygon tri = [(0,0), (1,0), (0,1)]',
    ],
  },
  {
    title: 'Curves, lists and regions',
    keywords: ['curve', 'region', 'for', 'in', 'step', 'map'],
    code: [
      'curve ring (t in 0..6.28) { (cos(t), sin(t)) }',
      'pts = (cos(t), sin(t)) for t in 0..6.28',
      'pts2 = map(i -> (cos(i), sin(i)), 0..6.28 step 0.1)',
      'region above = y > x^2',
    ],
  },
  {
    title: 'Conditionals',
    keywords: ['where', 'else', 'if', 'then'],
    code: [
      'v = x^2 where x > 0 else -x^2',
      'v2 = if x > 0 then x^2 else -x',
      'z = { x > 0: x^2, x < 0: -x, else: 0 }',
    ],
  },
  {
    title: 'Domain restriction',
    keywords: ['domain'],
    code: ['y = x^2 domain x > 0'],
    note: 'Adds a {x>0} filter to the Desmos expression.',
  },
  {
    title: 'Local bindings',
    keywords: ['expr'],
    code: [
      'expr {',
      '  cx = cos(t)',
      '  cy = sin(t)',
      '  (2*cx, cy)',
      '}',
    ],
    note: 'The bindings are inlined at compile time. The last line is the result.',
  },
  {
    title: 'Compile-time checks',
    keywords: ['debug'],
    code: ['debug hyp(a, b)'],
    note: 'Emits nothing to the graph. Use it to check that a name resolves.',
  },
  {
    title: 'Text and folders',
    keywords: ['text', 'at', 'group'],
    code: [
      'text lbl = "hello" at (1, 2)',
      'group g as "My Folder"',
    ],
  },
  {
    title: 'Built-in generators',
    keywords: ['spiral', 'wave', 'grid'],
    code: [
      'spiral coil = spiral(turns=5, spacing=0.2)   // + cx, cy, rotate',
      'wave w = wave(freq=2, amp=1, phase=0)        // + cx, cy, xmin, xmax',
      'grid mesh = grid(10, 10)                     // + xmin, xmax, ymin, ymax',
    ],
  },
  {
    title: 'The clock',
    keywords: ['time', 'period', 'loop', 'mirror'],
    code: [
      'time T = 0..6.28 period 4000   // period is milliseconds for one sweep',
      '// time T = 0..1 mirror        // mirror turns around instead of jumping back',
    ],
    note: 'One clock per file. It drives the timeline bar under the graph, and it is an ordinary variable everywhere else.',
  },
  {
    title: '3D projection',
    keywords: ['camera', 'azimuth', 'elevation', 'project'],
    code: [
      'time T = 0..1',
      'camera cam = azimuth(6.28 * T), elevation(0.5)',
      'corner = project(1, 1, 2)      // project(x, y, z); z defaults to 0',
    ],
    note: 'The camera angles are ordinary expressions, so animating one turns the scene.',
  },
  {
    title: 'Styling',
    keywords: ['as'],
    code: [
      'point p2 (0, 0) as { color red pointSize 12 }',
      'region r2 = y < x as { color blue opacity 0.3 fill }',
      'curve unit (t in 0..6.28) { (cos(t), sin(t)) } as gradient("blue", "red")',
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


export interface BuiltinFn {
  name: string;
  signature: string;
  snippet?: string;
  doc?: string;
}

export const BUILTINS: readonly BuiltinFn[] = [
  { name: 'sin',    signature: 'sin(x) → number' },
  { name: 'cos',    signature: 'cos(x) → number' },
  { name: 'tan',    signature: 'tan(x) → number' },
  { name: 'arcsin', signature: 'arcsin(x) → number' },
  { name: 'arccos', signature: 'arccos(x) → number' },
  { name: 'arctan', signature: 'arctan(x) → number' },
  { name: 'ln',     signature: 'ln(x) → number' },
  { name: 'log',    signature: 'log(x) → number' },
  { name: 'exp',    signature: 'exp(x) → number' },
  { name: 'sqrt',   signature: 'sqrt(x) → number' },
  { name: 'abs',    signature: 'abs(x) → number' },
  { name: 'floor',  signature: 'floor(x) → number' },
  { name: 'ceil',   signature: 'ceil(x) → number' },
  { name: 'round',  signature: 'round(x) → number' },
  { name: 'sign',   signature: 'sign(x) → number' },
  { name: 'min',    signature: 'min(a, b, ...) → number', snippet: '(${1:a}, ${2:b})' },
  { name: 'max',    signature: 'max(a, b, ...) → number', snippet: '(${1:a}, ${2:b})' },
  { name: 'mod',    signature: 'mod(a, b) → number',      snippet: '(${1:a}, ${2:b})' },

  {
    name: 'rgb',
    signature: 'rgb(r, g, b) → color  (0–255 each)',
    snippet: '(${1:255}, ${2:0}, ${3:0})',
    doc: 'Desmos color via RGB (0–255 each). Shown as an inline color swatch.',
  },
  {
    name: 'hsv',
    signature: 'hsv(h, s, v) → color  (h: 0–360, s/v: 0–1)',
    snippet: '(${1:0}, ${2:1}, ${3:1})',
    doc: 'Desmos color via HSV. Shown as an inline color swatch.',
  },

  {
    name: 'slider',
    signature: 'slider(value, min, max, speed?) → number',
    snippet: '(${1:0}, ${2:0}, ${3:10})',
    doc: 'A draggable Desmos slider.',
  },
  {
    name: 'project',
    signature: 'project(x, y, z?) → point',
    snippet: '(${1:x}, ${2:y}, ${3:z})',
    doc: 'Projects a 3D point onto the graph, using the declared camera. z defaults to 0.',
  },

  {
    name: 'ease',
    signature: 'ease(u) → number  (u: 0–1)',
    snippet: '(${1:u})',
    doc: 'Smoothstep. Starts and ends at rest, so motion does not jump.',
  },
  {
    name: 'pulse',
    signature: 'pulse(u) → number  (u: 0–1)',
    snippet: '(${1:u})',
    doc: 'Rises 0 → 1 → 0 across the sweep.',
  },
  {
    name: 'bounce',
    signature: 'bounce(u) → number  (u: 0–1)',
    snippet: '(${1:u})',
    doc: 'A bounce off zero. Same shape as pulse, but it eases at the top.',
  },
  {
    name: 'wobble',
    signature: 'wobble(u, amp?) → number  (u: 0–1)',
    snippet: '(${1:u}, ${2:1})',
    doc: 'One full sine cycle across the sweep. amp defaults to 1.',
  },
  {
    name: 'orbit',
    signature: 'orbit(u, r?) → point  (u: 0–1)',
    snippet: '(${1:u}, ${2:1})',
    doc: 'A point going once around a circle of radius r. r defaults to 1.',
  },

  { name: 'polygon', signature: 'polygon(p1, p2, ...) → polygon', snippet: '(${1:p})' },
];

export const STYLE_FNS: readonly BuiltinFn[] = [
  { name: 'gradient', signature: 'gradient(from, to) → color' },
];

export const CONSTRUCTORS: readonly BuiltinFn[] = [
  {
    name: 'point',
    signature: 'point(x, y) → point',
    snippet: '(${1:0}, ${2:0})',
    doc: 'A labelled point. `point p = (1, 2)` says the same thing.',
  },
  {
    name: 'circle',
    signature: 'circle(center, radius) → circle',
    snippet: '(center=(${1:0}, ${2:0}), radius=${3:1})',
    doc: 'Compiles to (x-h)²+(y-k)²=r².',
  },
  {
    name: 'line',
    signature: 'line(slope, intercept?) → line',
    snippet: '(slope=${1:1}, intercept=${2:0})',
    doc: 'A line by slope. `line l = 2x + y == 4` gives the standard form instead.',
  },
  {
    name: 'curve',
    signature: 'curve(fn, range) → curve',
    snippet: '(${1:t} -> (cos(${1:t}), sin(${1:t})), 0..6.28)',
    doc: 'A point body draws a parametric curve. A number body makes a list.',
  },
  { name: 'region',  signature: 'region(inequality) → region',   snippet: '(${1:y > x^2})' },
  { name: 'polygon', signature: 'polygon(points) → polygon',     snippet: '([(${1:0},${2:0}), (${3:1},${4:0})])' },
  { name: 'segment', signature: 'segment(from, to) → segment',   snippet: '((${1:0},${2:0}), (${3:1},${4:1}))' },
  { name: 'text',    signature: 'text(content, at) → text',      snippet: '("${1:label}", at=(${2:0}, ${3:0}))' },
  { name: 'group',   signature: 'group(label) → folder',         snippet: '("${1:Folder}")' },
  {
    name: 'time',
    signature: 'time(range, period?, mode?) → number',
    snippet: '(0..${1:6.28}, period=${2:4000})',
    doc: 'The one clock of the file. period is milliseconds for one sweep, mode is loop or mirror.',
  },
  {
    name: 'camera',
    signature: 'camera(azimuth, elevation) → camera',
    snippet: '(azimuth=${1:0.6}, elevation=${2:0.4})',
    doc: 'The angles project() reads.',
  },
  { name: 'spiral', signature: 'spiral(turns, spacing, cX?, cY?, rotate?) → curve', snippet: '(turns=${1:5}, spacing=${2:0.2})' },
  { name: 'wave',   signature: 'wave(freq, amp, phase?, cX?, cY?, xMin?, xMax?) → curve', snippet: '(freq=${1:2}, amp=${2:1})' },
  { name: 'grid',   signature: 'grid(cols, rows, xMin?, xMax?, yMin?, yMax?) → grid', snippet: '(${1:10}, ${2:10})' },
  {
    name: 'map',
    signature: 'map(fn, range) → list',
    snippet: '(${1:i} -> ${2:i^2}, 0..1 step 0.1)',
    doc: 'The same list as [expr for i in range].',
  },
];

export const CONSTRUCTOR_NAMES: readonly string[] = CONSTRUCTORS.map(c => c.name);

export const ANIMATION_PRESETS = ['ease', 'pulse', 'bounce', 'wobble', 'orbit'] as const;

export const BUILTIN_NAMES: readonly string[] = BUILTINS.map(b => b.name);

const BY_NAME = new Map(BUILTINS.map(b => [b.name, b]));
const SIGS = new Map([...BUILTINS, ...STYLE_FNS, ...CONSTRUCTORS].map(b => [b.name, b.signature]));

export function isBuiltin(name: string): boolean {
  return BY_NAME.has(name);
}

export function builtinSignature(name: string): string | undefined {
  return SIGS.get(name);
}

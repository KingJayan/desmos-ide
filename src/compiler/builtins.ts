// the one list of callable builtins. the analyzer decides what compiles from it, and
// the editor's highlighting, completion and hovers all read the same entries, so a
// function can never be highlighted but rejected, or accepted but undocumented.

export interface BuiltinFn {
  name: string;
  /** shown on hover */
  signature: string;
  /** monaco snippet body, without the name */
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

// callable only in an `as { }` block, so the analyzer must not accept them as expressions
export const STYLE_FNS: readonly BuiltinFn[] = [
  { name: 'gradient', signature: 'gradient(from, to) → color' },
];

export const ANIMATION_PRESETS = ['ease', 'pulse', 'bounce', 'wobble', 'orbit'] as const;

export const BUILTIN_NAMES: readonly string[] = BUILTINS.map(b => b.name);

const BY_NAME = new Map(BUILTINS.map(b => [b.name, b]));
const SIGS = new Map([...BUILTINS, ...STYLE_FNS].map(b => [b.name, b.signature]));

export function isBuiltin(name: string): boolean {
  return BY_NAME.has(name);
}

export function builtinSignature(name: string): string | undefined {
  return SIGS.get(name);
}

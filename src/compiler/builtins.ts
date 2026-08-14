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
  { name: 'time',    signature: 'time(period?) → number', snippet: '(${1:1000})', doc: 'An animating clock value.' },
  { name: 'project', signature: 'project(x, y) → point',  snippet: '(${1:x}, ${2:y})' },
  { name: 'camera',  signature: 'camera(x, y) → point',   snippet: '(${1:x}, ${2:y})' },
  { name: 'polygon', signature: 'polygon(p1, p2, ...) → polygon', snippet: '(${1:p})' },
];

export const BUILTIN_NAMES: readonly string[] = BUILTINS.map(b => b.name);

const BY_NAME = new Map(BUILTINS.map(b => [b.name, b]));

export function isBuiltin(name: string): boolean {
  return BY_NAME.has(name);
}

export function builtinSignature(name: string): string | undefined {
  return BY_NAME.get(name)?.signature;
}

// generated sources for the compiler benchmarks

const HEADER = [
  'fn sq(v) = v^2',
  'fn wobble(v, k) = sin(v * k) + cos(v / (k + 1))',
  'fn blend(u, v) = u * 0.5 + v * 0.5',
  'e0 = 1',
  'e1 = 2',
  'e2 = 3',
];

function statement(i: number): string {
  switch (i % 6) {
    case 0: return `a${i} = ${i % 17} + 1`;
    case 1: return `b${i} = sq(a${i - 1}) * 2 + wobble(a${i - 1}, 3)`;
    case 2: return `point p${i} (a${i - 2}, b${i - 1})`;
    case 3: return `c${i} = blend(a${i - 3}, b${i - 2}) / (1 + 0)`;
    case 4: return `circle k${i} = circle((a${i - 4}, 0), 1 + c${i - 1})`;
    default: return `d${i} = c${i - 2} where x > 0 else -c${i - 2}`;
  }
}

export type Where = 'top' | 'middle' | 'bottom';

/** the scratch line each edit rewrites, so no edit can break a declaration something else uses */
function scratch(where: Where, value: number): string {
  return `scratch_${where} = ${value}`;
}

/** a syntactically valid, semantically clean source of roughly `lines` statements */
export function generate(lines: number): string {
  const body: string[] = [];
  for (let i = 6; i < lines; i++) body.push(statement(i));

  const mid = Math.floor(body.length / 2);
  const out = [
    ...HEADER,
    scratch('top', 0),
    ...body.slice(0, mid),
    scratch('middle', 0),
    ...body.slice(mid),
    scratch('bottom', 0),
    '',
  ];
  return out.join('\n');
}

export type EditKind = `${'char' | 'newline'}-${Where}`;

export const EDIT_KINDS: EditKind[] = [
  'char-top', 'char-middle', 'char-bottom',
  'newline-top', 'newline-middle', 'newline-bottom',
];

/** applies one keystroke-sized edit, returning the new source */
export function applyEdit(src: string, kind: EditKind, step: number): string {
  const lines = src.split('\n');
  const [what, where] = kind.split('-') as ['char' | 'newline', Where];
  const at = lines.findIndex(l => l.startsWith(`scratch_${where} =`));
  if (at < 0) throw new Error(`no scratch line for ${where}`);

  if (what === 'char') lines[at] = scratch(where, step % 1000);
  else lines.splice(at + 1, 0, `fresh_${where}_${step} = ${step % 13}`);

  return lines.join('\n');
}

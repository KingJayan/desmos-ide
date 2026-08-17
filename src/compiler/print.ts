// prints an ast node back as dsl text. the optimizer report reads it, so it has
// to stay short and lossless enough to recognise, not to round-trip through parse

import * as T from './types';

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
const UNARY_PREC = 3;

function num(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Math.round(value * 1e9) / 1e9;
  return String(rounded);
}

function prec(e: T.Expr): number {
  if (e.type === 'BinOp') return PREC[e.op] ?? 0;
  if (e.type === 'UnaryOp') return UNARY_PREC;
  if (e.type === 'CompareExpr' || e.type === 'ConditionalExpr') return 0;
  return 99;
}

function operand(e: T.Expr, parent: number, side: 'left' | 'right'): string {
  const own = prec(e);
  const needs = own < parent || (own === parent && side === 'right');
  const text = printExpr(e);
  return needs ? `(${text})` : text;
}

export function printExpr(e: T.Expr): string {
  switch (e.type) {
    case 'NumLit':    return num(e.value);
    case 'StringLit': return JSON.stringify(e.value);
    case 'Ident':     return e.name;

    case 'UnaryOp':
      return `-${operand(e.operand, UNARY_PREC, 'right')}`;

    case 'BinOp': {
      const p = PREC[e.op] ?? 0;
      const l = operand(e.left, p, 'left');
      const r = operand(e.right, p, 'right');
      if (e.op === '*' && e.implicit) return `${l}${r}`;
      return `${l} ${e.op} ${r}`;
    }

    case 'CompareExpr':
      return `${printExpr(e.left)} ${e.op} ${printExpr(e.right)}`;

    case 'ConditionalExpr':
      return `${printExpr(e.then)} where ${printExpr(e.cond)} else ${printExpr(e.else_)}`;

    case 'PiecewiseExpr': {
      const parts = e.branches.map(b =>
        b.cond === null ? `else: ${printExpr(b.body)}` : `${printExpr(b.cond)}: ${printExpr(b.body)}`);
      return `{ ${parts.join(', ')} }`;
    }

    case 'Call': {
      const args = e.args.map(printExpr);
      if (e.kwargs) {
        for (const [k, v] of Object.entries(e.kwargs)) args.push(`${k}=${printExpr(v)}`);
      }
      return `${e.fn}(${args.join(', ')})`;
    }

    case 'Tuple':
      return `(${printExpr(e.x)}, ${printExpr(e.y)})`;

    case 'ListRange':
      return e.step
        ? `${printExpr(e.start)}..${printExpr(e.end)} step ${printExpr(e.step)}`
        : `${printExpr(e.start)}..${printExpr(e.end)}`;

    case 'MapExpr':
      return `map(${e.var} -> ${printExpr(e.body)}, ${printExpr(e.range)})`;

    case 'ForExpr': {
      const range = e.step
        ? `${printExpr(e.start)}..${printExpr(e.end)} step ${printExpr(e.step)}`
        : `${printExpr(e.start)}..${printExpr(e.end)}`;
      return `${printExpr(e.body)} for ${e.var} in ${range}`;
    }
  }
}

/** the report shows one line per note, so a long body is cut rather than wrapped */
export function printShort(e: T.Expr, max = 48): string {
  const text = printExpr(e);
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

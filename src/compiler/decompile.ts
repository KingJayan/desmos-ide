// decompiles a desmos expr back into dsmx (inverse of codegen)

import type { DesmosExpr } from './codegen';

// latex tokens

type Tok =
  | { k: 'num'; v: string }
  | { k: 'name'; v: string }
  | { k: 'op'; v: string }
  | { k: 'cmd'; v: string }
  | { k: 'open'; v: '(' | '[' | '{' }
  | { k: 'close'; v: ')' | ']' | '}' };

const GREEK = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma',
  'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
];

const FN_CMDS: Record<string, string> = {
  sin: 'sin', cos: 'cos', tan: 'tan',
  arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
  ln: 'ln', log: 'log', exp: 'exp', min: 'min', max: 'max',
  sqrt: 'sqrt',
};

const CMP_CMDS: Record<string, string> = { ge: '>=', le: '<=', neq: '!=' };

class LexFail extends Error {}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i];

    if (c === ' ' || c === '\n' || c === '\t') { i++; continue; }

    if (c === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(src.slice(i));
      if (!m) {
        // \{ and \} are grouping, anything else is not ours
        if (src[i + 1] === '{' || src[i + 1] === '}') {
          out.push(src[i + 1] === '{' ? { k: 'open', v: '{' } : { k: 'close', v: '}' });
          i += 2;
          continue;
        }
        throw new LexFail(`unknown escape at ${i}`);
      }
      const word = m[1];
      i += m[0].length;

      if (word === 'left' || word === 'right') {
        // bracket that follows belongs to group
        while (src[i] === ' ') i++;
        let br = src[i];
        if (br === '\\') { i++; br = src[i]; }
        if (br === undefined) throw new LexFail('dangling \\left');
        i++;
        if (word === 'left') out.push({ k: 'open', v: br as '(' | '[' | '{' });
        else out.push({ k: 'close', v: br as ')' | ']' | '}' });
        continue;
      }
      out.push({ k: 'cmd', v: word });
      continue;
    }

    if (c >= '0' && c <= '9') {
      const m = /^\d+(\.\d+)?/.exec(src.slice(i))!;
      out.push({ k: 'num', v: m[0] });
      i += m[0].length;
      continue;
    }

    if (/[a-zA-Z]/.test(c)) { out.push({ k: 'name', v: c }); i++; continue; }

    if (c === '{' || c === '(' || c === '[') { out.push({ k: 'open', v: c }); i++; continue; }
    if (c === '}' || c === ')' || c === ']') { out.push({ k: 'close', v: c }); i++; continue; }

    if ('+-*/^_,<>='.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }

    throw new LexFail(`unexpected ${c}`);
  }
  return out;
}

// latex ast

type Node =
  | { k: 'num'; v: string }
  | { k: 'name'; v: string }
  | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'neg'; e: Node }
  | { k: 'call'; fn: string; args: Node[] }
  | { k: 'tuple'; items: Node[] }
  | { k: 'list'; items: Node[] }
  | { k: 'cmp'; op: string; l: Node; r: Node };

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  atEnd(): boolean { return this.i >= this.toks.length; }
  private peek(): Tok | undefined { return this.toks[this.i]; }
  private next(): Tok { const t = this.toks[this.i++]; if (!t) throw new LexFail('ran out'); return t; }

  private eatClose(v: string): void {
    const t = this.next();
    if (t.k !== 'close' || t.v !== v) throw new LexFail(`expected ${v}`);
  }

  parseTop(): Node {
    const node = this.parseCmp();
    if (!this.atEnd()) throw new LexFail('trailing input');
    return node;
  }

  private parseCmp(): Node {
    const l = this.parseSum();
    const t = this.peek();
    if (t?.k === 'op' && '=<>'.includes(t.v)) {
      this.i++;
      // desmos writes >= as \ge, so a bare < or > never pairs with =
      return { k: 'cmp', op: t.v, l, r: this.parseSum() };
    }
    if (t?.k === 'cmd' && CMP_CMDS[t.v]) {
      this.i++;
      return { k: 'cmp', op: CMP_CMDS[t.v], l, r: this.parseSum() };
    }
    return l;
  }

  private parseSum(): Node {
    let l = this.parseProduct();
    for (;;) {
      const t = this.peek();
      if (t?.k === 'op' && (t.v === '+' || t.v === '-')) {
        this.i++;
        l = { k: 'bin', op: t.v, l, r: this.parseProduct() };
        continue;
      }
      return l;
    }
  }

  private parseProduct(): Node {
    let l = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t?.k === 'cmd' && t.v === 'cdot') {
        this.i++;
        l = { k: 'bin', op: '*', l, r: this.parseUnary() };
        continue;
      }
      if (t?.k === 'op' && (t.v === '*' || t.v === '/')) {
        this.i++;
        l = { k: 'bin', op: t.v, l, r: this.parseUnary() };
        continue;
      }
      // juxtaposition is multiplication, the way `2x` is in the DSL
      if (this.startsAtom()) {
        l = { k: 'bin', op: '*', l, r: this.parseUnary() };
        continue;
      }
      return l;
    }
  }

  private startsAtom(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.k === 'num' || t.k === 'name') return true;
    if (t.k === 'open' && t.v === '(') return true;
    if (t.k === 'cmd') return t.v === 'frac' || !!FN_CMDS[t.v] || GREEK.includes(t.v);
    return false;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t?.k === 'op' && t.v === '-') { this.i++; return { k: 'neg', e: this.parseUnary() }; }
    return this.parsePower();
  }

  private parsePower(): Node {
    const base = this.parseAtom();
    const t = this.peek();
    if (t?.k === 'op' && t.v === '^') {
      this.i++;
      return { k: 'bin', op: '^', l: base, r: this.parseGroupOrAtom() };
    }
    return base;
  }

  /** `^{...}` wraps its argument in braces; `^2` does not */
  private parseGroupOrAtom(): Node {
    const t = this.peek();
    if (t?.k === 'open' && t.v === '{') {
      this.i++;
      const inner = this.parseSum();
      this.eatClose('}');
      return inner;
    }
    return this.parseUnary();
  }

  private parseBraced(): Node {
    const t = this.next();
    if (t.k !== 'open' || t.v !== '{') throw new LexFail('expected {');
    const inner = this.parseSum();
    this.eatClose('}');
    return inner;
  }

  /** reads a `name` or `name_{suffix}` identifier, inverse of nameToLatex */
  private parseIdent(head: string): Node {
    const name = this.parseIdentName(head);
    const after = this.peek();
    if (after?.k === 'open' && after.v === '(') {
      return { k: 'call', fn: name.v, args: this.parseArgs() };
    }
    return name;
  }

  private parseIdentName(head: string): { k: 'name'; v: string } {
    const t = this.peek();
    if (t?.k === 'op' && t.v === '_') {
      this.i++;
      const parts: string[] = [];
      const open = this.next();
      if (open.k !== 'open' || open.v !== '{') throw new LexFail('expected { after _');
      for (;;) {
        const p = this.peek();
        if (!p) throw new LexFail('unterminated subscript');
        if (p.k === 'close' && p.v === '}') { this.i++; break; }
        if (p.k === 'name' || p.k === 'num') { parts.push(p.v); this.i++; continue; }
        throw new LexFail('subscript is not a name');
      }
      const suffix = parts.join('');
      return { k: 'name', v: /^\d/.test(suffix) ? `${head}_${suffix}` : head + suffix };
    }
    return { k: 'name', v: head };
  }

  private parseArgs(): Node[] {
    const open = this.next();
    if (open.k !== 'open' || open.v !== '(') throw new LexFail('expected (');
    const args: Node[] = [];
    if (this.peek()?.k === 'close') { this.i++; return args; }
    for (;;) {
      args.push(this.parseSum());
      const t = this.next();
      if (t.k === 'close' && t.v === ')') return args;
      if (t.k === 'op' && t.v === ',') continue;
      throw new LexFail('bad argument list');
    }
  }

  private parseAtom(): Node {
    const t = this.next();

    if (t.k === 'num') return { k: 'num', v: t.v };
    if (t.k === 'name') return this.parseIdent(t.v);

    if (t.k === 'open' && (t.v === '(' || t.v === '[')) {
      const closing = t.v === '(' ? ')' : ']';
      const items: Node[] = [];
      if (this.peek()?.k === 'close') { this.i++; }
      else {
        for (;;) {
          items.push(this.parseCmp());
          const n = this.next();
          if (n.k === 'close' && n.v === closing) break;
          if (n.k === 'op' && n.v === ',') continue;
          throw new LexFail('bad group');
        }
      }
      if (t.v === '[') return { k: 'list', items };
      if (items.length === 1) return items[0];
      if (items.length === 2) return { k: 'tuple', items };
      throw new LexFail('a parenthesised group with 3+ parts is not a DSL value');
    }

    if (t.k === 'cmd') {
      if (t.v === 'frac') {
        const num = this.parseBraced();
        const den = this.parseBraced();
        return { k: 'bin', op: '/', l: num, r: den };
      }
      if (t.v === 'operatorname') {
        const open = this.next();
        if (open.k !== 'open' || open.v !== '{') throw new LexFail('expected {');
        let name = '';
        for (;;) {
          const p = this.next();
          if (p.k === 'close' && p.v === '}') break;
          if (p.k !== 'name') throw new LexFail('bad operatorname');
          name += p.v;
        }
        return { k: 'call', fn: name, args: this.parseArgs() };
      }
      if (FN_CMDS[t.v]) return { k: 'call', fn: FN_CMDS[t.v], args: this.parseArgs() };
      if (GREEK.includes(t.v)) return { k: 'name', v: t.v };
      throw new LexFail(`unsupported command \\${t.v}`);
    }

    throw new LexFail('unexpected token');
  }
}

// dsl output

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

function print(n: Node, parentOp = '', side: 'left' | 'right' = 'left'): string {
  switch (n.k) {
    case 'num':  return n.v;
    case 'name': return n.v;
    case 'neg':  return parentOp === '^' || parentOp === '*' ? `(-${print(n.e, 'unary')})` : `-${print(n.e, 'unary')}`;
    case 'call': return `${n.fn}(${n.args.map(a => print(a)).join(', ')})`;
    case 'tuple': return `(${n.items.map(a => print(a)).join(', ')})`;
    case 'list': return `[${n.items.map(a => print(a)).join(', ')}]`;
    case 'cmp': return `${print(n.l)} ${n.op} ${print(n.r)}`;
    case 'bin': {
      const text = `${print(n.l, n.op, 'left')} ${n.op} ${print(n.r, n.op, 'right')}`;
      const mine = PREC[n.op];
      const theirs = PREC[parentOp] ?? 0;
      const needed = mine < theirs
        || (mine === theirs && side === 'right' && (parentOp === '-' || parentOp === '/'));
      return needed ? `(${text})` : text;
    }
  }
}

export function latexToDsl(latex: string): string | null {
  try {
    const node = new Parser(lex(latex)).parseTop();
    return print(node);
  } catch {
    return null;
  }
}

function parseLatex(latex: string): Node | null {
  try {
    return new Parser(lex(latex)).parseTop();
  } catch {
    return null;
  }
}

// any whole statement

function isPlainName(n: Node): n is { k: 'name'; v: string } {
  return n.k === 'name';
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * a DSL statement for a desmos expression or null
 */
export function decompile(expr: DesmosExpr, name: string): string | null {
  if (expr.type === 'folder') return expr.title ? `group ${name} = group(${quote(expr.title)})` : null;
  if (expr.type === 'text') return null;
  if (!expr.latex) return null;

  const node = parseLatex(expr.latex);
  if (!node) return null;

  // a = slider(value, min, max)
  if (expr.slider && node.k === 'cmp' && node.op === '=' && isPlainName(node.l)) {
    const { min, max, isPlaying } = expr.slider;
    if (min === undefined || max === undefined) return null;
    if (isPlaying) return null;
    return `${node.l.v} = slider(${print(node.r)}, ${min}, ${max})`;
  }

  // curve name = curve(t -> body, min..max)
  if (expr.parametricDomain && node.k === 'tuple') {
    const { min, max } = expr.parametricDomain;
    return `curve ${name} = curve(t -> ${print(node)}, ${min}..${max})`;
  }

  // text name = text("label", at=(x, y))
  if (expr.label && node.k === 'cmp' && node.op === '=' && node.r.k === 'tuple') {
    if (isPlainName(node.l) && expr.label !== node.l.v) {
      return `text ${node.l.v} = text(${quote(expr.label)}, at=${print(node.r)})`;
    }
    if (isPlainName(node.l)) return `point ${node.l.v} = ${print(node.r)}`;
  }

  // point name (x, y)
  if (node.k === 'cmp' && node.op === '=' && isPlainName(node.l) && node.r.k === 'tuple') {
    return `point ${node.l.v} = ${print(node.r)}`;
  }

  // segment name = a -> b
  if (node.k === 'list' && node.items.length === 2 && node.items.every(p => p.k === 'tuple')) {
    return `segment ${name} = segment(${print(node.items[0])}, ${print(node.items[1])})`;
  }

  // polygon name = [points]
  if (node.k === 'call' && node.fn === 'polygon') {
    return `polygon ${name} = polygon([${node.args.map(a => print(a)).join(', ')}])`;
  }

  // region name = inequality
  if (node.k === 'cmp' && node.op !== '=') {
    return `region ${name} = ${print(node)}`;
  }

  // fn name(params) = body
  if (node.k === 'cmp' && node.op === '=' && node.l.k === 'call') {
    const params = node.l.args;
    if (params.every(isPlainName)) {
      const list = (params as { k: 'name'; v: string }[]).map(p => p.v).join(', ');
      return `fn ${node.l.fn}(${list}) = ${print(node.r)}`;
    }
    return null;
  }

  // name = value
  if (node.k === 'cmp' && node.op === '=' && isPlainName(node.l)) {
    return `${node.l.v} = ${print(node.r)}`;
  }

  return null;
}

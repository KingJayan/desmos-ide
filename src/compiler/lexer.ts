// lexer + tokenizer

export const KEYWORDS = new Set([
  'fn', 'in', 'map', 'point', 'circle', 'line',
  'time', 'project', 'camera',

  'for', 'step', 'where', 'else', 'region', 'polygon', 'segment',
  'curve', 'group', 'text', 'as', 'at',

  'spiral', 'wave', 'grid',

  'alias', 'debug', 'domain', 'if', 'then', 'expr', 'loop', 'use',

  'period', 'mirror', 'azimuth', 'elevation',
]);

export type TT =
  | 'kw'
  | 'ident'
  | 'num'
  | 'str'        // string literal "..."
  | 'op'         // + - * / ^ = > < >= <= != == (single or multi-char)
  | 'lparen' | 'rparen'
  | 'lbrace' | 'rbrace'
  | 'lbracket' | 'rbracket'
  | 'comma'
  | 'colon'
  | 'ellipsis'   // ...
  | 'dotdot'     // ..
  | 'dot'
  | 'arrow'      // ->
  | 'nl'         // statement terminator
  | 'eof';

export interface Token {
  type: TT;
  value: string;
  line: number;
  col: number;
  /** true when anything at all separates this token from the one before it */
  spaceBefore: boolean;
  /** the source text, present only where normalising changed it (`α` -> `alpha`) */
  raw?: string;
}

export class LexError extends Error {
  constructor(
    msg: string,
    public readonly line: number,
    public readonly col: number,
  ) {
    super(`[${line}:${col}] Lex error: ${msg}`);
    this.name = 'LexError';
  }
}

// a newline only ends a statement when the line is complete: not inside brackets,
// and not right after a token that still needs a right-hand side
const CONTINUES_LINE = new Set<TT>([
  'op', 'comma', 'colon', 'arrow', 'dotdot', 'ellipsis', 'dot', 'kw', 'nl',
  'lparen', 'lbrace', 'lbracket',
]);

// greek letters are ordinary identifier characters, the way desmos treats them.
// each one normalises to its ascii name so `α` and `alpha` are the same variable everywhere.
const GREEK_CHAR_NAMES: Record<string, string> = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
  'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa',
  'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'π': 'pi',
  'ρ': 'rho', 'σ': 'sigma', 'τ': 'tau', 'υ': 'upsilon', 'φ': 'phi',
  'χ': 'chi', 'ψ': 'psi', 'ω': 'omega',
};

export function normalizeIdent(name: string): string {
  return name.replace(/[α-ω]/g, ch => GREEK_CHAR_NAMES[ch] ?? ch);
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch in GREEK_CHAR_NAMES;
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  let depth = 0;

  const col = () => i - lineStart + 1;

  let sawGap = false;
  const push = (type: TT, value: string, overrideCol?: number) => {
    tokens.push({ type, value, line, col: overrideCol ?? col(), spaceBefore: sawGap });
    sawGap = false;
  };

  while (i < src.length) {
    const ch = src[i];

    // newline
    if (ch === '\n') {
      const prev = tokens[tokens.length - 1];
      if (depth === 0 && prev && !CONTINUES_LINE.has(prev.type)) push('nl', '\n');
      line++; lineStart = ++i;
      sawGap = true;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; sawGap = true; continue; }

    // line comment
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      sawGap = true;
      continue;
    }

    // nums (ints and decimals)
    if ((ch >= '0' && ch <= '9') || (ch === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      const start = i;
      const startCol = col();
      while (i < src.length && src[i] >= '0' && src[i] <= '9') i++;
      if (i < src.length && src[i] === '.' && i + 1 < src.length && src[i + 1] >= '0' && src[i + 1] <= '9') {
        i++;
        while (i < src.length && src[i] >= '0' && src[i] <= '9') i++;
      }
      // scientific notation, but only when real digits follow, so `2e` stays `2 * e`
      if (i < src.length && (src[i] === 'e' || src[i] === 'E')) {
        let j = i + 1;
        if (src[j] === '+' || src[j] === '-') j++;
        if (src[j] >= '0' && src[j] <= '9') {
          i = j;
          while (i < src.length && src[i] >= '0' && src[i] <= '9') i++;
        }
      }
      push('num', src.slice(start, i), startCol);
      continue;
    }

    // idents / kws
    if (isIdentStart(ch)) {
      const start = i;
      const startCol = col();
      while (i < src.length && isIdentPart(src[i])) i++;
      const text = src.slice(start, i);
      const word = normalizeIdent(text);
      push(KEYWORDS.has(word) ? 'kw' : 'ident', word, startCol);
      if (word !== text) tokens[tokens.length - 1].raw = text;
      continue;
    }

    // string literal "..."
    if (ch === '"') {
      const startCol = col();
      i++;
      const start = i;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\n') throw new LexError('Unterminated string literal', line, col());
        i++;
      }
      if (i >= src.length) throw new LexError('Unterminated string literal', line, col());
      const value = src.slice(start, i);
      i++;
      push('str', value, startCol);
      continue;
    }

    // ellipsis/dotdot before single dot
    if (ch === '.' && src.slice(i, i + 3) === '...') { push('ellipsis', '...'); i += 3; continue; }
    if (ch === '.' && src[i + 1] === '.' && src[i + 2] !== '.') { push('dotdot', '..'); i += 2; continue; }

    const startCol = col();
    if (ch === '-' && src[i + 1] === '>') { push('arrow', '->',  startCol); i += 2; continue; }
    if (ch === '>' && src[i + 1] === '=') { push('op',    '>=',  startCol); i += 2; continue; }
    if (ch === '<' && src[i + 1] === '=') { push('op',    '<=',  startCol); i += 2; continue; }
    if (ch === '!' && src[i + 1] === '=') { push('op',    '!=',  startCol); i += 2; continue; }
    if (ch === '=' && src[i + 1] === '=') { push('op',    '==',  startCol); i += 2; continue; }

    switch (ch) {
      case '(': push('lparen',   ch, startCol); depth++; i++; break;
      case ')': push('rparen',   ch, startCol); depth = Math.max(0, depth - 1); i++; break;
      case '{': push('lbrace',   ch, startCol); depth++; i++; break;
      case '}': push('rbrace',   ch, startCol); depth = Math.max(0, depth - 1); i++; break;
      case '[': push('lbracket', ch, startCol); depth++; i++; break;
      case ']': push('rbracket', ch, startCol); depth = Math.max(0, depth - 1); i++; break;
      case ',': push('comma',    ch, startCol); i++; break;
      case ':': push('colon',    ch, startCol); i++; break;
      case '.': push('dot',      ch, startCol); i++; break;
      case '>': push('op',       ch, startCol); i++; break;
      case '<': push('op',       ch, startCol); i++; break;
      case '+': case '-': case '*': case '/':
      case '^': case '=':
        push('op', ch, startCol); i++; break;
      default:
        throw new LexError(`Unexpected character '${ch}'`, line, col());
    }
  }

  tokens.push({ type: 'eof', value: '', line, col: col(), spaceBefore: true });
  return tokens;
}

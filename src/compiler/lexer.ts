// lexer + tokenizer

export const KEYWORDS = new Set([
  'let', 'fn', 'in', 'map',
  'point', 'circle', 'line', 'points',
  'time', 'project', 'camera',
]);

export type TT =
  | 'kw'
  | 'ident'       // identifier
  | 'num'         // num literal
  | 'op'          // operator: + - * / ^ =
  | 'lparen' | 'rparen'
  | 'lbrace' | 'rbrace'
  | 'lbracket' | 'rbracket'
  | 'comma'
  | 'colon'
  | 'ellipsis'    // ...
  | 'dotdot'      // ..
  | 'dot'
  | 'eof';

export interface Token {
  type: TT;
  value: string;
  line: number;
  col: number;
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

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;

  const col = () => i - lineStart + 1;

  const push = (type: TT, value: string, overrideCol?: number) =>
    tokens.push({ type, value, line, col: overrideCol ?? col() });

  while (i < src.length) {
    const ch = src[i];

    // newline — track for line/col
    if (ch === '\n') { line++; lineStart = ++i; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

    // line comment
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // nums  (ints and decimals)
    if ((ch >= '0' && ch <= '9') || (ch === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      const start = i;
      const startCol = col();
      while (i < src.length && src[i] >= '0' && src[i] <= '9') i++;
      // Only consume decimal point when followed by a digit (not `...`)
      if (i < src.length && src[i] === '.' && i + 1 < src.length && src[i + 1] >= '0' && src[i + 1] <= '9') {
        i++;
        while (i < src.length && src[i] >= '0' && src[i] <= '9') i++;
      }
      push('num', src.slice(start, i), startCol);
      continue;
    }

    // idnets / kws
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      const start = i;
      const startCol = col();
      while (
        i < src.length &&
        ((src[i] >= 'a' && src[i] <= 'z') ||
         (src[i] >= 'A' && src[i] <= 'Z') ||
         (src[i] >= '0' && src[i] <= '9') ||
         src[i] === '_')
      ) i++;
      const word = src.slice(start, i);
      push(KEYWORDS.has(word) ? 'kw' : 'ident', word, startCol);
      continue;
    }

    // ellipsis/dotdot must come before single dot check
    if (ch === '.' && src.slice(i, i + 3) === '...') {
      push('ellipsis', '...');
      i += 3;
      continue;
    }
    if (ch === '.' && src[i + 1] === '.' && src[i + 2] !== '.') {
      push('dotdot', '..');
      i += 2;
      continue;
    }

    // single-char tokens
    const startCol = col();
    switch (ch) {
      case '(': push('lparen',   ch, startCol); i++; break;
      case ')': push('rparen',   ch, startCol); i++; break;
      case '{': push('lbrace',   ch, startCol); i++; break;
      case '}': push('rbrace',   ch, startCol); i++; break;
      case '[': push('lbracket', ch, startCol); i++; break;
      case ']': push('rbracket', ch, startCol); i++; break;
      case ',': push('comma',    ch, startCol); i++; break;
      case ':': push('colon',    ch, startCol); i++; break;
      case '.': push('dot',      ch, startCol); i++; break;
      case '+': case '-': case '*': case '/':
      case '^': case '=':
        push('op', ch, startCol); i++; break;
      default:
        throw new LexError(`Unexpected character '${ch}'`, line, col());
    }
  }

  tokens.push({ type: 'eof', value: '', line, col: col() });
  return tokens;
}

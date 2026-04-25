// lexer + tokenizer

export const KEYWORDS = new Set([
  'fn', 'in', 'map', 'point', 'circle', 'line',
  'time', 'project', 'camera',

  'for', 'step', 'where', 'else', 'region', 'polygon', 'segment',
  'curve', 'group', 'text', 'as', 'at',

  'spiral', 'wave', 'grid',

  'alias', 'debug', 'domain', 'if', 'then', 'expr', 'loop',
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

    // newline
    if (ch === '\n') { line++; lineStart = ++i; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

    // line comment
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
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
      push('num', src.slice(start, i), startCol);
      continue;
    }

    // idents / kws
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
      case '(': push('lparen',   ch, startCol); i++; break;
      case ')': push('rparen',   ch, startCol); i++; break;
      case '{': push('lbrace',   ch, startCol); i++; break;
      case '}': push('rbrace',   ch, startCol); i++; break;
      case '[': push('lbracket', ch, startCol); i++; break;
      case ']': push('rbracket', ch, startCol); i++; break;
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

  tokens.push({ type: 'eof', value: '', line, col: col() });
  return tokens;
}

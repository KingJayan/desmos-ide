// dsl formatter
//
// this walks characters rather than the ast on purpose: an editor formats files that are
// mid-edit and therefore do not compile, and the ast has no comments in it. the result is
// idempotent — formatting formatted source returns it unchanged.

const INDENT = '  ';

type Kind =
  | 'num' | 'ident' | 'str' | 'comment'
  | 'op' | 'open' | 'close' | 'comma' | 'colon' | 'range' | 'arrow';

interface Piece {
  kind: Kind;
  text: string;
  /** whitespace separated this piece from the one before it in the source */
  gap: boolean;
}

const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_Α-ω]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

/** splits one line into pieces, keeping strings and comments verbatim */
function scanLine(line: string): Piece[] {
  const out: Piece[] = [];
  let i = 0;
  let gap = false;

  const push = (kind: Kind, text: string) => { out.push({ kind, text, gap }); gap = false; };

  while (i < line.length) {
    const ch = line[i];

    if (ch === ' ' || ch === '\t') { i++; gap = true; continue; }

    if (ch === '/' && line[i + 1] === '/') { push('comment', line.slice(i)); break; }

    if (ch === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      push('str', line.slice(i, Math.min(j + 1, line.length)));
      i = j + 1;
      continue;
    }

    if ((ch >= '0' && ch <= '9') || (ch === '.' && line[i + 1] >= '0' && line[i + 1] <= '9')) {
      const start = i;
      while (i < line.length && line[i] >= '0' && line[i] <= '9') i++;
      if (line[i] === '.' && line[i + 1] >= '0' && line[i + 1] <= '9') {
        i++;
        while (i < line.length && line[i] >= '0' && line[i] <= '9') i++;
      }
      if (line[i] === 'e' || line[i] === 'E') {
        let j = i + 1;
        if (line[j] === '+' || line[j] === '-') j++;
        if (line[j] >= '0' && line[j] <= '9') {
          i = j;
          while (i < line.length && line[i] >= '0' && line[i] <= '9') i++;
        }
      }
      push('num', line.slice(start, i));
      continue;
    }

    if (isIdentStart(ch)) {
      const start = i;
      while (i < line.length && isIdentPart(line[i])) i++;
      push('ident', line.slice(start, i));
      continue;
    }

    if (line.startsWith('...', i)) { push('range', '...'); i += 3; continue; }
    if (line.startsWith('..', i))  { push('range', '..');  i += 2; continue; }
    if (line.startsWith('->', i))  { push('arrow', '->');  i += 2; continue; }
    const two = line.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === '!=' || two === '==') {
      push('op', two);
      i += 2;
      continue;
    }

    if (OPEN.has(ch))       { push('open', ch);  i++; continue; }
    if (CLOSE.has(ch))      { push('close', ch); i++; continue; }
    if (ch === ',')         { push('comma', ch); i++; continue; }
    if (ch === ':')         { push('colon', ch); i++; continue; }

    // anything else, operators included, passes through one character at a time so that
    // an unknown character in a half-written line never derails the whole file
    push('op', ch);
    i++;
  }

  return out;
}

// keywords that end with a value still to come, so a `-` right after one negates
const KEYWORD_OPS = new Set(['else', 'then', 'step', 'in', 'at', 'where', 'domain', 'radius', 'as']);

/** true when a `-` at this position negates rather than subtracts */
function isUnaryMinus(prev: Piece | undefined): boolean {
  if (!prev) return true;
  if (prev.kind === 'ident') return KEYWORD_OPS.has(prev.text);
  return prev.kind === 'op' || prev.kind === 'open' || prev.kind === 'comma'
    || prev.kind === 'colon' || prev.kind === 'arrow' || prev.kind === 'range';
}

/** juxtaposition means multiplication, so `2x` must not gain a space */
function isImplicitProduct(prev: Piece, cur: Piece): boolean {
  if (cur.gap) return false;
  const prevEnds = prev.kind === 'num' || prev.kind === 'ident' || (prev.kind === 'close' && prev.text === ')');
  const curStarts = cur.kind === 'num' || cur.kind === 'ident' || (cur.kind === 'open' && cur.text === '(');
  return prevEnds && curStarts;
}

function joinPieces(pieces: Piece[], startDepth: number): string {
  let out = '';
  let parens = startDepth;

  for (let i = 0; i < pieces.length; i++) {
    const cur = pieces[i];
    const prev = pieces[i - 1];

    // parens is the depth the piece sits at, so an opening paren is counted after the
    // spacing decision and a closing one before it
    if (cur.kind === 'close' && cur.text === ')') parens = Math.max(0, parens - 1);

    if (!prev) { out += cur.text; if (cur.text === '(') parens++; continue; }

    let space = true;

    if (cur.kind === 'comma' || cur.kind === 'colon') space = false;
    // inside a call an `=` is a kwarg, which reads tighter than an assignment
    else if (parens > 0 && (cur.text === '=' || prev.text === '=')) space = false;
    else if (cur.kind === 'close' && cur.text !== '}') space = false;
    else if (prev.kind === 'open' && prev.text !== '{') space = false;
    else if (cur.kind === 'range' || prev.kind === 'range') space = false;
    else if (cur.text === '^' || prev.text === '^') space = false;
    else if (prev.text === '-' && isUnaryMinus(pieces[i - 2])) space = false;
    else if (cur.kind === 'open' && cur.text === '(' && !cur.gap && prev.kind === 'ident') space = false;
    else if (isImplicitProduct(prev, cur)) space = false;

    out += (space ? ' ' : '') + cur.text;
    if (cur.kind === 'open' && cur.text === '(') parens++;
  }

  return out;
}

function netDepth(pieces: Piece[]): number {
  let d = 0;
  for (const p of pieces) {
    if (p.kind === 'open') d++;
    else if (p.kind === 'close') d--;
  }
  return d;
}

function leadingCloses(pieces: Piece[]): number {
  let n = 0;
  for (const p of pieces) {
    if (p.kind === 'close') n++;
    else break;
  }
  return n;
}

export function formatDsl(src: string): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let depth = 0;
  let parenDepth = 0;
  let blanks = 0;

  for (const raw of lines) {
    const pieces = scanLine(raw);

    if (pieces.length === 0) {
      // several blank lines in a row collapse to one, and leading blanks are dropped
      blanks++;
      continue;
    }
    if (blanks > 0 && out.length > 0) out.push('');
    blanks = 0;

    const closes = Math.min(leadingCloses(pieces), depth);
    const indent = INDENT.repeat(Math.max(0, depth - closes));
    out.push(indent + joinPieces(pieces, parenDepth));
    depth = Math.max(0, depth + netDepth(pieces));
    parenDepth = Math.max(0, parenDepth + netDepth(pieces.filter(p => p.text === '(' || p.text === ')')));
  }

  return out.length ? `${out.join('\n')}\n` : '';
}

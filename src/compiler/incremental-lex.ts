// incremental tokenizer for the lexer

import { tokenize, type Token } from './lexer';
import type { Pos } from './types';

/** every position in a chunk reads its line through this, so moving a chunk is one write */
interface Base { n: number }

// refers to one statement worth of tokens
export interface Chunk {
  base: Base;
  lineCount: number;
  tokens: Token[];
}

export interface LexCache {
  src: string;
  lines: string[];
  chunks: Chunk[];
}

function startLine(c: Chunk): number {
  return c.base.n + 1;
}

function livePos(base: Base, rel: number, col: number): Pos {
  return { col, get line() { return base.n + rel; } };
}

/** rewrites middle-relative lines to absolute and hands every token a chunk-tracking position */
function bind(tokens: Token[], base: Base, offset: number): void {
  for (const t of tokens) {
    const abs = t.line + offset;
    t.line = abs;
    t.pos = livePos(base, abs - base.n, t.col);
  }
}

function toChunks(tokens: Token[], offset: number, lastLine: number): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  let from = offset + 1;

  const cut = (end: number, nextLine: number) => {
    const base: Base = { n: from - 1 };
    const slice = tokens.slice(start, end);
    bind(slice, base, offset);
    chunks.push({ base, lineCount: nextLine - from, tokens: slice });
    start = end;
    from = nextLine;
  };

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'nl') continue;
    const next = tokens[i + 1];
    cut(i + 1, next ? next.line + offset : lastLine + 1);
  }
  if (start < tokens.length) cut(tokens.length, lastLine + 1);

  return chunks;
}

function withoutEof(tokens: Token[]): Token[] {
  return tokens[tokens.length - 1]?.type === 'eof' ? tokens.slice(0, -1) : tokens;
}

export function lexCacheOf(src: string, lines = src.split('\n')): LexCache {
  const tokens = withoutEof(tokenize(src));
  return { src, lines, chunks: toChunks(tokens, 0, lines.length) };
}

export function tokenizeIncremental(src: string, prev: LexCache | null): { tokens: Token[]; cache: LexCache } {
  const cache = lexIncremental(src, prev);
  return { tokens: flatten(cache), cache };
}

export function lexIncremental(src: string, prev: LexCache | null): LexCache {
  if (!prev || prev.chunks.length === 0) return lexCacheOf(src);
  if (prev.src === src) return prev;

  const oldLines = prev.lines;
  const newLines = src.split('\n');

  let head = 0;
  while (head < oldLines.length && head < newLines.length && oldLines[head] === newLines[head]) head++;

  let tail = 0;
  while (
    tail < oldLines.length - head &&
    tail < newLines.length - head &&
    oldLines[oldLines.length - 1 - tail] === newLines[newLines.length - 1 - tail]
  ) tail++;

  // 1-based, inclusive, in old-source coordinates
  const firstChanged = head + 1;
  const lastChangedOld = oldLines.length - tail;
  const delta = newLines.length - oldLines.length;

  // keep every chunk that ends before the edit
  let headCount = 0;
  while (
    headCount < prev.chunks.length &&
    startLine(prev.chunks[headCount]) + prev.chunks[headCount].lineCount - 1 < firstChanged
  ) headCount++;

  // and every chunk that starts after it
  let tailStart = headCount;
  while (tailStart < prev.chunks.length && startLine(prev.chunks[tailStart]) <= lastChangedOld) tailStart++;

  const middleFrom = headCount === 0 ? 1 : startLine(prev.chunks[headCount - 1]) + prev.chunks[headCount - 1].lineCount;
  const middleToOld = tailStart < prev.chunks.length ? startLine(prev.chunks[tailStart]) - 1 : oldLines.length;
  const middleTo = middleToOld + delta;
  if (middleFrom > middleTo + 1) return lexCacheOf(src, newLines);

  const middleSrc = newLines.slice(middleFrom - 1, middleTo).join('\n') + (middleTo < newLines.length ? '\n' : '');

  let middleTokens: Token[];
  try {
    middleTokens = tokenize(middleSrc);
  } catch {
    return lexCacheOf(src, newLines);
  }
  middleTokens = withoutEof(middleTokens);

  if (middleFrom > 1 && middleTokens.length > 0) middleTokens[0] = { ...middleTokens[0], spaceBefore: true };

  const hasTail = tailStart < prev.chunks.length;
  const last = middleTokens[middleTokens.length - 1];

  if (hasTail && middleTokens.length > 0 && last.type !== 'nl') {
    return lexCacheOf(src, newLines);
  }

  const middleChunks = toChunks(middleTokens, middleFrom - 1, middleTo);

  for (let i = tailStart; i < prev.chunks.length; i++) prev.chunks[i].base.n += delta;

  const chunks: Chunk[] = [
    ...prev.chunks.slice(0, headCount),
    ...middleChunks,
    ...prev.chunks.slice(tailStart),
  ];

  return { src, lines: newLines, chunks };
}

export function eofToken(cache: LexCache): Token {
  const line = cache.lines.length;
  return { type: 'eof', value: '', line, col: cache.lines[line - 1].length + 1, spaceBefore: true };
}

function flatten(cache: LexCache): Token[] {
  const tokens: Token[] = [];
  for (const c of cache.chunks) {
    for (const t of c.tokens) {
      const plain: Token = { type: t.type, value: t.value, line: t.pos!.line, col: t.col, spaceBefore: t.spaceBefore };
      if (t.raw !== undefined) plain.raw = t.raw;
      tokens.push(plain);
    }
  }
  tokens.push(eofToken(cache));
  return tokens;
}

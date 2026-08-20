// incremental parsing layer

import { parse, type ParseErrorInfo } from './parser';
import { lexIncremental, eofToken, type LexCache } from './incremental-lex';
import type { Token } from './lexer';
import type { Program, Statement } from './types';

interface ParsedChunk {
  body: Statement[];
  errors: ParseErrorInfo[];
}

export interface ParseCache {
  lex: LexCache | null;
  chunks: WeakMap<Token[], ParsedChunk>;
  hits: number;
  misses: number;
}

export function createParseCache(): ParseCache {
  return { lex: null, chunks: new WeakMap(), hits: 0, misses: 0 };
}

function parseChunk(tokens: Token[], eof: Token): ParsedChunk {
  const { ast, parseErrors } = parse([...tokens, eof]);
  return { body: ast.body, errors: parseErrors };
}

export function parseIncremental(
  src: string,
  cache: ParseCache,
): { ast: Program; parseErrors: ParseErrorInfo[] } {
  cache.lex = lexIncremental(src, cache.lex);
  const chunks = cache.lex.chunks;
  const eof = eofToken(cache.lex);

  const body: Statement[] = [];
  const parseErrors: ParseErrorInfo[] = [];

  for (const chunk of chunks) {
    const tokens = chunk.tokens;
    const terminated = tokens[tokens.length - 1]?.type === 'nl';
    let parsed = terminated ? cache.chunks.get(tokens) : undefined;
    if (parsed) cache.hits++;
    else {
      cache.misses++;
      parsed = parseChunk(tokens, eof);
      // a parse error carries the line it was found on, which the chunk would then
      // outlive; statements read their line back through the chunk, so they may stay
      if (terminated && parsed.errors.length === 0) cache.chunks.set(tokens, parsed);
    }
    for (const s of parsed.body) body.push(s);
    if (parsed.errors.length > 0) for (const e of parsed.errors) parseErrors.push(e);
  }

  return { ast: { type: 'Program', body }, parseErrors };
}

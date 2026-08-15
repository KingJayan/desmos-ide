//text search over recent files

import { readFile, stat } from 'fs/promises';
import type { SearchHit, SearchResult } from '../src/shared/rpc-schema';

const MAX_HITS = 200;
const MAX_BYTES = 2 * 1024 * 1024;

export function buildMatcher(query: string, useRegex: boolean): RegExp | null {
  if (!query) return null;
  const source = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(source, 'gi');
  } catch {
    return null;
  }
}

export function findMatches(
  content: string,
  matcher: RegExp,
  path: string,
  limit = MAX_HITS,
): SearchHit[] {
  const hits: SearchHit[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length && hits.length < limit; i++) {
    // a /g regex carries lastIndex between calls, so reset before every line
    matcher.lastIndex = 0;
    const m = matcher.exec(lines[i]);
    if (!m) continue;
    hits.push({
      path,
      line: i + 1,
      col: m.index + 1,
      // long lines are trimmed for display, never for matching
      text: lines[i].length > 200 ? `${lines[i].slice(0, 200)}…` : lines[i],
    });
  }

  return hits;
}

export async function searchPaths(
  paths: string[],
  query: string,
  useRegex: boolean,
): Promise<SearchResult> {
  const matcher = buildMatcher(query, useRegex);
  if (!matcher) {
    return { ok: false, errorCode: 'BAD_QUERY', message: useRegex ? 'Invalid regular expression.' : 'Enter something to search for.' };
  }

  const hits: SearchHit[] = [];
  let scanned = 0;

  for (const path of paths) {
    if (hits.length >= MAX_HITS) break;
    try {
      if ((await stat(path)).size > MAX_BYTES) continue;
      const content = await readFile(path, 'utf-8');
      scanned++;
      hits.push(...findMatches(content, matcher, path, MAX_HITS - hits.length));
    } catch {
    }
  }

  return { ok: true, hits, scanned };
}

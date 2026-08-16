// text search, over the recent files or over a whole folder

import { readdir, readFile, stat } from 'fs/promises';
import { extname, join } from 'path';
import type { SearchHit, SearchResult } from '../src/shared/rpc-schema';

const MAX_HITS = 200;
const MAX_BYTES = 2 * 1024 * 1024;

/** a folder walk needs its own bounds, since it does not get a list to work from */
const MAX_FILES = 2000;
const MAX_DEPTH = 12;
const SEARCHABLE = new Set(['.dsmx', '.json', '.txt', '.md']);
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'target',
  '.cache', '.next', 'vendor', '__pycache__',
]);

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
    const line = lines[i];
    // long lines are trimmed for display, never for matching
    const text = line.length > 200 ? `${line.slice(0, 200)}…` : line;

    let m: RegExpExecArray | null;
    while (hits.length < limit && (m = matcher.exec(line)) !== null) {
      hits.push({ path, line: i + 1, col: m.index + 1, text });
      // an empty match would never advance lastIndex on its own
      if (m[0] === '') matcher.lastIndex++;
    }
  }

  return hits;
}

/** every searchable file under root, breadth first so near files come back first */
export async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  let level = [root];

  for (let depth = 0; depth < MAX_DEPTH && level.length && files.length < MAX_FILES; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) next.push(full);
        } else if (entry.isFile() && SEARCHABLE.has(extname(entry.name).toLowerCase())) {
          if (files.length >= MAX_FILES) break;
          files.push(full);
        }
      }
    }
    level = next;
  }

  return files;
}

export async function searchFolder(
  root: string,
  query: string,
  useRegex: boolean,
): Promise<SearchResult> {
  if (typeof root !== 'string' || !root) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'No folder to search.' };
  }
  return searchPaths(await collectFiles(root), query, useRegex);
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

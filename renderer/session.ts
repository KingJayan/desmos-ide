// remembers what was open between launches, and the files opened before that

export type Mode = 'dsl' | 'split' | 'enhanced';

export interface RecentFile {
  path: string;
  openedAt: number;
}

export interface SessionState {
  path: string | null;
  source: string;
  mode: Mode;
  line: number;
  col: number;
  savedAt: number;
}

const SESSION_KEY = 'ide-session';
const RECENT_KEY = 'ide-recent-files';
export const RECENT_LIMIT = 12;

const MODES: Mode[] = ['dsl', 'split', 'enhanced'];

/** most recent first, no duplicates, capped */
export function pushRecent(list: RecentFile[], path: string, now = Date.now()): RecentFile[] {
  if (!path) return list;
  return [{ path, openedAt: now }, ...list.filter(f => f.path !== path)].slice(0, RECENT_LIMIT);
}

export function removeRecent(list: RecentFile[], path: string): RecentFile[] {
  return list.filter(f => f.path !== path);
}

/** the basename, plus enough parent directories to tell same-named files apart */
export function recentLabel(path: string, others: string[]): { name: string; hint: string } {
  const parts = path.split(/[\\/]/);
  const name = parts[parts.length - 1] ?? path;
  const clashes = others.some(o => o !== path && o.split(/[\\/]/).pop() === name);
  return { name, hint: clashes ? parts.slice(0, -1).slice(-2).join('/') : parts.slice(0, -1).join('/') };
}

export function parseRecent(raw: string | null): RecentFile[] {
  const list = safeParse(raw);
  if (!Array.isArray(list)) return [];
  return list
    .filter((f): f is RecentFile => !!f && typeof f.path === 'string' && !!f.path)
    .map(f => ({ path: f.path, openedAt: typeof f.openedAt === 'number' ? f.openedAt : 0 }))
    .slice(0, RECENT_LIMIT);
}

export function parseSession(raw: string | null): SessionState | null {
  const s = safeParse(raw) as Partial<SessionState> | null;
  if (!s || typeof s.source !== 'string') return null;
  return {
    path: typeof s.path === 'string' && s.path ? s.path : null,
    source: s.source,
    // enhanced mode edits the graph, not the file, so restoring into it would be confusing
    mode: MODES.includes(s.mode as Mode) && s.mode !== 'enhanced' ? (s.mode as Mode) : 'dsl',
    line: positive(s.line),
    col: positive(s.col),
    savedAt: typeof s.savedAt === 'number' ? s.savedAt : 0,
  };
}

function positive(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function store(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

let onStoreFailure: (message: string) => void = () => {};
let reported = false;

/** a store that refuses a write loses the session, which the user must be told about once */
export function reportStoreFailures(report: (message: string) => void): void {
  onStoreFailure = report;
}

function write(key: string, value: string): void {
  try {
    store()?.setItem(key, value);
  } catch {
    if (reported) return;
    reported = true;
    onStoreFailure('This browser refused to store the session, so the open file and the recent list are not remembered.');
  }
}

export function loadRecent(): RecentFile[] {
  return parseRecent(store()?.getItem(RECENT_KEY) ?? null);
}

export function saveRecent(list: RecentFile[]): void {
  write(RECENT_KEY, JSON.stringify(list));
}

export function loadSession(): SessionState | null {
  return parseSession(store()?.getItem(SESSION_KEY) ?? null);
}

export function saveSession(state: Omit<SessionState, 'savedAt'>): void {
  write(SESSION_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
}

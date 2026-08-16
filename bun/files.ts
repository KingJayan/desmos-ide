import { readFile, writeFile } from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import { showOpenDialog, showSaveDialog } from './dialogs';
import type { FileResult } from '../src/shared/rpc-schema';

const CANCELED = { ok: false, canceled: true, errorCode: 'CANCELED', message: '' } as const;

function fileError(err: unknown): FileResult<never> {
  const e = err as NodeJS.ErrnoException;
  const code = e.code ?? 'UNKNOWN';
  const msgs: Record<string, string> = {
    EACCES: 'Permission denied — check file permissions.',
    ENOENT: 'File not found — it may have been moved or deleted.',
    ENOSPC: 'Disk full — free up space and try again.',
    EISDIR: 'Expected a file but got a directory.',
  };
  return { ok: false, errorCode: code, message: msgs[code] ?? `File error (${code}): ${e.message}` };
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const transient = code === 'EBUSY' || code === 'EAGAIN' || code === 'EMFILE';
      if (!transient || i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

export async function openFile(): Promise<FileResult<{ path: string; content: string }>> {
  const path = await showOpenDialog({ extensions: ['dsmx'] });
  if (!path) return CANCELED;
  try {
    const content = await withRetry(() => readFile(path, 'utf-8'));
    return { ok: true, path, content };
  } catch (err) {
    return fileError(err);
  }
}

// opens a known path with no dialog, for the recent-files list and search results
export async function readFileAt(path: string): Promise<FileResult<{ path: string; content: string }>> {
  if (typeof path !== 'string' || !path) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Path must be a string.' };
  }
  try {
    return { ok: true, path, content: await withRetry(() => readFile(path, 'utf-8')) };
  } catch (err) {
    return fileError(err);
  }
}

export async function saveFile(path: string | null, content: string): Promise<FileResult<{ path: string }>> {
  if (typeof content !== 'string') return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Content must be a string.' };
  let savePath = path;
  try {
    if (!savePath) {
      savePath = await showSaveDialog({ defaultName: 'untitled.dsmx', extension: 'dsmx', prompt: 'Save DSL file' });
      if (!savePath) return CANCELED;
    }
    await withRetry(() => writeFile(savePath!, content, 'utf-8'));
    noteSelfWrite(savePath, content);
    return { ok: true, path: savePath };
  } catch (err) {
    return fileError(err);
  }
}

async function exportAs(
  content: string,
  dialog: { defaultName: string; extension: string; prompt: string },
): Promise<FileResult<{ path: string }>> {
  if (typeof content !== 'string') return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Content must be a string.' };
  try {
    const path = await showSaveDialog(dialog);
    if (!path) return CANCELED;
    await withRetry(() => writeFile(path, content, 'utf-8'));
    return { ok: true, path };
  } catch (err) {
    return fileError(err);
  }
}

export function exportJson(content: string): Promise<FileResult<{ path: string }>> {
  return exportAs(content, { defaultName: 'expressions.json', extension: 'json', prompt: 'Export expressions' });
}

export function exportTex(content: string, defaultName: string): Promise<FileResult<{ path: string }>> {
  return exportAs(content, { defaultName, extension: 'tex', prompt: 'Export a pgfplots figure' });
}

type WatcherEntry = { watcher: FSWatcher; debounce: ReturnType<typeof setTimeout> | null };
const fileWatchers = new Map<string, WatcherEntry>();

// autosave when typing stops
const selfWrites = new Map<string, string>();

function noteSelfWrite(path: string, content: string): void {
  if (fileWatchers.has(path)) selfWrites.set(path, content);
}

export function unwatchFile(path: string): void {
  const entry = fileWatchers.get(path);
  if (!entry) return;
  if (entry.debounce) clearTimeout(entry.debounce);
  entry.watcher.close();
  fileWatchers.delete(path);
  selfWrites.delete(path);
}

export function unwatchAll(): void {
  for (const path of [...fileWatchers.keys()]) unwatchFile(path);
}

export function watchFile(path: string, onChange: (path: string, content: string) => void): void {
  if (!path) return;
  unwatchFile(path);
  const entry: WatcherEntry = { watcher: null!, debounce: null };
  entry.watcher = watch(path, { persistent: false }, eventType => {
    if (eventType !== 'change') return;
    if (entry.debounce) clearTimeout(entry.debounce);
    entry.debounce = setTimeout(async () => {
      try {
        const content = await readFile(path, 'utf-8');
        if (selfWrites.get(path) === content) return;
        selfWrites.delete(path);
        onChange(path, content);
      } catch {}
    }, 250);
  });
  fileWatchers.set(path, entry);
}

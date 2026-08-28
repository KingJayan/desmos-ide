import { readFile, stat, writeFile } from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import { basename, dirname } from 'path';
import { showOpenDialog, showSaveDialog } from './dialogs';
import { allowFile, allowed, allowedRoot } from './paths';
import { collectFiles } from './search';
import type { FileResult, FolderListing } from '../src/shared/rpc-schema';

const MAX_LISTED = 200;

const CANCELED = { ok: false, canceled: true, errorCode: 'CANCELED', message: '' } as const;

const NOT_ALLOWED = {
  ok: false,
  errorCode: 'NOT_ALLOWED',
  message: 'This app has not been given that path. Open it through File → Open once.',
} as const;

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
  const picked = await showOpenDialog({ extensions: ['dsmx'] });
  if (!picked) return CANCELED;
  const path = allowFile(picked);
  if (!path) return NOT_ALLOWED;
  try {
    const content = await withRetry(() => readFile(path, 'utf-8'));
    return { ok: true, path, content };
  } catch (err) {
    return fileError(err);
  }
}

export async function openJsonFile(): Promise<FileResult<{ path: string; content: string }>> {
  const picked = await showOpenDialog({ extensions: ['json'] });
  if (!picked) return CANCELED;
  const path = allowFile(picked);
  if (!path) return NOT_ALLOWED;
  try {
    return { ok: true, path, content: await withRetry(() => readFile(path, 'utf-8')) };
  } catch (err) {
    return fileError(err);
  }
}

export async function readFileAt(raw: string): Promise<FileResult<{ path: string; content: string }>> {
  if (typeof raw !== 'string' || !raw) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Path must be a string.' };
  }
  const path = allowed(raw);
  if (!path) return NOT_ALLOWED;
  try {
    return { ok: true, path, content: await withRetry(() => readFile(path, 'utf-8')) };
  } catch (err) {
    return fileError(err);
  }
}

export async function listFolder(raw: string): Promise<FolderListing> {
  const root = allowedRoot(raw);
  if (!root) return { ok: false, message: 'This app has not been given that folder.' };
  try {
    const files = (await collectFiles(root)).filter(path => path.toLowerCase().endsWith('.dsmx'));
    return {
      ok: true,
      root,
      entries: files.slice(0, MAX_LISTED).map(path => ({ path, name: basename(path) })),
      truncated: files.length > MAX_LISTED,
    };
  } catch (err) {
    return { ok: false, message: fileError(err).message };
  }
}

export async function saveFile(path: string | null, content: string): Promise<FileResult<{ path: string }>> {
  if (typeof content !== 'string') return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Content must be a string.' };
  let savePath = path ? allowed(path) : null;
  if (path && !savePath) return NOT_ALLOWED;
  try {
    if (!savePath) {
      const picked = await showSaveDialog({ defaultName: 'untitled.dsmx', extension: 'dsmx', prompt: 'Save DSL file' });
      if (!picked) return CANCELED;
      savePath = allowFile(picked);
      if (!savePath) return NOT_ALLOWED;
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

export function exportJson(content: string, defaultName = 'expressions.json'): Promise<FileResult<{ path: string }>> {
  return exportAs(content, { defaultName, extension: 'json', prompt: 'Export' });
}

export function exportTex(content: string, defaultName: string): Promise<FileResult<{ path: string }>> {
  return exportAs(content, { defaultName, extension: 'tex', prompt: 'Export a pgfplots figure' });
}

// a png arrives as a data uri, an svg as markup
export async function exportImage(
  data: string,
  defaultName: string,
  format: 'png' | 'svg',
): Promise<FileResult<{ path: string }>> {
  if (typeof data !== 'string' || !data) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'The graph produced no image.' };
  }
  try {
    const path = await showSaveDialog({ defaultName, extension: format, prompt: `Export the graph as ${format.toUpperCase()}` });
    if (!path) return CANCELED;

    if (format === 'svg') {
      await withRetry(() => writeFile(path, data, 'utf-8'));
    } else {
      const base64 = data.replace(/^data:image\/\w+;base64,/, '');
      await withRetry(() => writeFile(path, Buffer.from(base64, 'base64')));
    }
    return { ok: true, path };
  } catch (err) {
    return fileError(err);
  }
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

export function watchFile(raw: string, onChange: (path: string, content: string) => void): void {
  const path = allowed(raw);
  if (!path) return;
  unwatchFile(path);

  // the parent directory is watched, not the file: an editor that saves by writing a
  // temporary file and renaming it over the original leaves a file watch pointing at an
  // inode nothing writes to again
  const dir = dirname(path);
  const name = basename(path);

  const entry: WatcherEntry = { watcher: null!, debounce: null };

  const settle = () => {
    if (entry.debounce) clearTimeout(entry.debounce);
    entry.debounce = setTimeout(async () => {
      try {
        // a rename is either a replace or a delete, and only a stat tells them apart
        await stat(path);
        const content = await readFile(path, 'utf-8');
        if (selfWrites.get(path) === content) return;
        selfWrites.delete(path);
        onChange(path, content);
      } catch {}
    }, 250);
  };

  try {
    entry.watcher = watch(dir, { persistent: false }, (eventType, filename) => {
      if (eventType !== 'change' && eventType !== 'rename') return;
      if (filename && basename(filename.toString()) !== name) return;
      settle();
    });
  } catch {
    return;
  }

  fileWatchers.set(path, entry);
}

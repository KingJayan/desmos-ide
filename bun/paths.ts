import { mkdir, readFile, writeFile } from 'fs/promises';
import { realpathSync } from 'fs';
import { basename, dirname, join, resolve, sep } from 'path';
import { storePath } from './store';


const MAX_FILES = 400;
const MAX_ROOTS = 20;

const files = new Set<string>();
const roots = new Set<string>();
let loaded = false;
let writing: Promise<void> | null = null;

function real(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
  }
  const parent = dirname(path);
  return parent === path ? path : join(real(parent), basename(path));
}

function clean(path: unknown): string | null {
  if (typeof path !== 'string' || !path) return null;
  if (path.includes('\0')) return null;
  const full = real(resolve(path));
  return full.includes('\0') ? null : full;
}

function under(root: string, path: string): boolean {
  return path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);
}

function trim(set: Set<string>, max: number): void {
  while (set.size > max) set.delete(set.values().next().value as string);
}

async function persist(): Promise<void> {
  const body = JSON.stringify({ files: [...files], roots: [...roots] });
  writing = (async () => {
    try {
      await mkdir(storePath(), { recursive: true });
      await writeFile(storePath('allowed.json'), body, { encoding: 'utf-8', mode: 0o600 });
    } catch {
    }
  })();
  await writing;
}

export async function loadAllowed(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw: unknown = JSON.parse(await readFile(storePath('allowed.json'), 'utf-8'));
    const held = raw as { files?: unknown; roots?: unknown };
    for (const path of Array.isArray(held.files) ? held.files : []) {
      const full = clean(path);
      if (full) files.add(full);
    }
    for (const path of Array.isArray(held.roots) ? held.roots : []) {
      const full = clean(path);
      if (full) roots.add(full);
    }
  } catch {
  }
}

// a dialog is the only thing that widens the list: the user picked this path themselves.
// one picked file grants that file, never its folder.
export function allowFile(path: unknown): string | null {
  const full = clean(path);
  if (!full) return null;
  files.delete(full);
  files.add(full);
  trim(files, MAX_FILES);
  void persist();
  return full;
}

export function allowRoot(path: unknown): string | null {
  const full = clean(path);
  if (!full) return null;
  roots.delete(full);
  roots.add(full);
  trim(roots, MAX_ROOTS);
  void persist();
  return full;
}

export function allowed(path: unknown): string | null {
  const full = clean(path);
  if (!full) return null;
  if (files.has(full)) return full;
  for (const root of roots) if (under(root, full)) return full;
  return null;
}

export function allowedRoot(path: unknown): string | null {
  const full = clean(path);
  if (!full) return null;
  for (const root of roots) if (under(root, full)) return full;
  return null;
}

export async function flushAllowed(): Promise<void> {
  await writing;
}

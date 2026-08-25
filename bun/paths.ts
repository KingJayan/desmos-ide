import { mkdir, readFile, writeFile } from 'fs/promises';
import { realpathSync } from 'fs';
import { basename, dirname, join, resolve, sep } from 'path';
import { grantOwnerOnly } from './perms';
import { storePath } from './store';


const MAX_FILES = 400;
const MAX_ROOTS = 20;

const WIN = process.platform === 'win32';

const files = new Map<string, string>();
const roots = new Map<string, string>();
let loaded = false;
let writing: Promise<void> | null = null;

// \\?\C:\x and \\?\UNC\server\share name the same places as C:\x and \\server\share.
// realpath hands the long form back for a path over 260 characters
export function stripLongPrefix(path: string): string {
  if (path.startsWith('\\\\?\\UNC\\')) return `\\\\${path.slice(8)}`;
  if (path.startsWith('\\\\?\\')) return path.slice(4);
  return path;
}

export function compareKey(path: string, win = WIN): string {
  return win ? stripLongPrefix(path).toLowerCase() : path;
}

function real(path: string): string {
  try {
    return stripLongPrefix(realpathSync.native(path));
  } catch {
  }
  const parent = dirname(path);
  return parent === path ? path : join(real(parent), basename(path));
}

function clean(path: unknown): string | null {
  if (typeof path !== 'string' || !path) return null;
  if (path.includes('\0')) return null;
  const full = real(resolve(stripLongPrefix(path)));
  return full.includes('\0') ? null : full;
}

function under(root: string, path: string): boolean {
  return path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);
}

function trim(map: Map<string, string>, max: number): void {
  while (map.size > max) map.delete(map.keys().next().value as string);
}

async function persist(): Promise<void> {
  const body = JSON.stringify({ files: [...files.values()], roots: [...roots.values()] });
  writing = (async () => {
    try {
      await mkdir(storePath(), { recursive: true });
      const path = storePath('allowed.json');
      await writeFile(path, body, { encoding: 'utf-8', mode: 0o600 });
      await grantOwnerOnly(path);
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
      if (full) files.set(compareKey(full), full);
    }
    for (const path of Array.isArray(held.roots) ? held.roots : []) {
      const full = clean(path);
      if (full) roots.set(compareKey(full), full);
    }
  } catch {
  }
}

// a dialog is the only thing that widens the list: the user picked this path themselves.
// one picked file grants that file, never its folder.
export function allowFile(path: unknown): string | null {
  const full = clean(path);
  if (!full) return null;
  const key = compareKey(full);
  files.delete(key);
  files.set(key, full);
  trim(files, MAX_FILES);
  void persist();
  return full;
}

export function allowRoot(path: unknown): string | null {
  const full = clean(path);
  if (!full) return null;
  const key = compareKey(full);
  roots.delete(key);
  roots.set(key, full);
  trim(roots, MAX_ROOTS);
  void persist();
  return full;
}

export function allowed(path: unknown): string | null {
  const full = clean(path);
  if (!full) return null;
  const key = compareKey(full);
  if (files.has(key)) return full;
  for (const root of roots.keys()) if (under(root, key)) return full;
  return null;
}

export function allowedRoot(path: unknown): string | null {
  const full = clean(path);
  if (!full) return null;
  const key = compareKey(full);
  for (const root of roots.keys()) if (under(root, key)) return full;
  return null;
}

export async function flushAllowed(): Promise<void> {
  await writing;
}

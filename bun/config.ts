import { watch } from 'fs';
import type { FSWatcher } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import type { ConfigFile } from '../src/shared/rpc-schema';
import { storePath } from './store';

const SEED: Record<ConfigFile, string> = { settings: '{}\n', keybinds: '[]\n' };
const MAX_BYTES = 256 * 1024;

const selfWrites = new Map<ConfigFile, string>();
const watchers = new Map<ConfigFile, { watcher: FSWatcher; debounce: ReturnType<typeof setTimeout> | null }>();

export function configPath(file: ConfigFile): string {
  return storePath(`${file}.json`);
}

export async function readConfig(file: ConfigFile): Promise<{ path: string; content: string }> {
  const path = configPath(file);
  try {
    const content = await readFile(path, 'utf-8');
    return { path, content };
  } catch {
    return { path, content: SEED[file] };
  }
}

export async function writeConfig(file: ConfigFile, content: string): Promise<boolean> {
  if (typeof content !== 'string' || content.length > MAX_BYTES) return false;
  try {
    await mkdir(storePath(), { recursive: true });
    selfWrites.set(file, content);
    await writeFile(configPath(file), content, { encoding: 'utf-8', mode: 0o600 });
    return true;
  } catch {
    selfWrites.delete(file);
    return false;
  }
}

export function watchConfig(onChange: (file: ConfigFile, content: string) => void): void {
  for (const file of ['settings', 'keybinds'] as const) {
    if (watchers.has(file)) continue;
    let watcher: FSWatcher;
    try {
      watcher = watch(configPath(file), { persistent: false }, eventType => {
        if (eventType !== 'change') return;
        const entry = watchers.get(file);
        if (!entry) return;
        if (entry.debounce) clearTimeout(entry.debounce);
        entry.debounce = setTimeout(async () => {
          const { content } = await readConfig(file);
          if (selfWrites.get(file) === content) return;
          selfWrites.delete(file);
          onChange(file, content);
        }, 250);
      });
    } catch {
      continue;
    }
    watchers.set(file, { watcher, debounce: null });
  }
}

export function unwatchConfig(): void {
  for (const [file, entry] of watchers) {
    if (entry.debounce) clearTimeout(entry.debounce);
    entry.watcher.close();
    watchers.delete(file);
  }
}

export async function ensureConfig(): Promise<void> {
  await mkdir(storePath(), { recursive: true }).catch(() => {});
  for (const file of ['settings', 'keybinds'] as const) {
    try {
      await readFile(configPath(file), 'utf-8');
    } catch {
      await writeFile(configPath(file), SEED[file], { encoding: 'utf-8', mode: 0o600 }).catch(() => {});
    }
  }
}

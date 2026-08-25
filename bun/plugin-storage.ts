
import { createHash } from 'crypto';
import { chmod, mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { storePath } from './store';
import { deleteSecret, getSecret, secretsAvailable, setSecret } from './secrets';
import type { PluginState } from '../src/plugin/manifest';

const root = (): string => storePath('plugins', 'storage');

const ID = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;
const KEY = /^[\w.-]{1,64}$/;

const MAX_STATE = 256 * 1024;

interface GlobalFile {
  values: Record<string, unknown>;
}

function safeId(id: string): string | null {
  return ID.test(id) ? id : null;
}

function workspaceTag(workspace: string | null): string | null {
  if (!workspace) return null;
  return createHash('sha256').update(workspace).digest('hex').slice(0, 16);
}

function pluginDir(id: string): string {
  return join(root(), id);
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const text = await readFile(path, 'utf-8');
    if (text.length > MAX_STATE) return null;
    const raw: unknown = JSON.parse(text);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function writeJson(path: string, value: unknown): Promise<boolean> {
  try {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, JSON.stringify(value, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

async function readGlobal(id: string): Promise<GlobalFile> {
  const raw = await readJson(join(pluginDir(id), 'global.json'));
  const values = raw?.['values'];
  return {
    values: values && typeof values === 'object' && !Array.isArray(values) ? (values as Record<string, unknown>) : {},
  };
}

async function readWorkspace(id: string, workspace: string | null): Promise<Record<string, unknown>> {
  const tag = workspaceTag(workspace);
  if (!tag) return {};
  return (await readJson(join(pluginDir(id), 'workspace', `${tag}.json`))) ?? {};
}

async function storageDir(id: string, workspace: string | null): Promise<string | null> {
  const tag = workspaceTag(workspace);
  const dir = tag ? join(pluginDir(id), 'files', 'workspace', tag) : null;
  if (!dir) return null;
  try {
    await mkdir(dir, { recursive: true });
    return dir;
  } catch {
    return null;
  }
}

async function globalStorageDir(id: string): Promise<string | null> {
  const dir = join(pluginDir(id), 'files', 'global');
  try {
    await mkdir(dir, { recursive: true });
    return dir;
  } catch {
    return null;
  }
}

export async function pluginState(id: string, workspace: string | null): Promise<PluginState> {
  const empty: PluginState = { global: {}, workspace: {}, storagePath: null, globalStoragePath: null };
  if (!safeId(id)) return empty;

  const [global, ws, storagePath, globalStoragePath] = await Promise.all([
    readGlobal(id),
    readWorkspace(id, workspace),
    storageDir(id, workspace),
    globalStorageDir(id),
  ]);
  return { global: global.values, workspace: ws, storagePath, globalStoragePath };
}

export async function updatePluginState(
  id: string,
  scope: 'global' | 'workspace',
  workspace: string | null,
  key: string,
  value: unknown,
): Promise<boolean> {
  if (!safeId(id) || !KEY.test(key)) return false;

  if (scope === 'global') {
    const file = await readGlobal(id);
    if (value === null) delete file.values[key];
    else file.values[key] = value;
    return writeJson(join(pluginDir(id), 'global.json'), file);
  }

  const tag = workspaceTag(workspace);

  if (!tag) return false;
  const path = join(pluginDir(id), 'workspace', `${tag}.json`);
  const values = (await readJson(path)) ?? {};
  if (value === null) delete values[key];
  else values[key] = value;
  return writeJson(path, values);
}

function account(id: string, key: string): string {
  return `plugin.${id}.${key}`;
}

async function readFallback(id: string): Promise<Record<string, string>> {
  const raw = await readJson(join(pluginDir(id), 'secrets.json'));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw ?? {})) if (typeof v === 'string') out[k] = v;
  return out;
}

async function writeFallback(id: string, values: Record<string, string>): Promise<boolean> {
  const path = join(pluginDir(id), 'secrets.json');
  if (!(await writeJson(path, values))) return false;
  try { await chmod(path, 0o600); } catch {}
  return true;
}

export async function getPluginSecret(id: string, key: string): Promise<string | null> {
  if (!safeId(id) || !KEY.test(key)) return null;
  if (secretsAvailable()) return getSecret(account(id, key));
  return (await readFallback(id))[key] ?? null;
}

export async function storePluginSecret(id: string, key: string, value: string): Promise<boolean> {
  if (!safeId(id) || !KEY.test(key)) return false;
  if (secretsAvailable()) return setSecret(account(id, key), value);
  const values = await readFallback(id);
  values[key] = value;
  return writeFallback(id, values);
}

export async function deletePluginSecret(id: string, key: string): Promise<boolean> {
  if (!safeId(id) || !KEY.test(key)) return false;
  if (secretsAvailable()) return deleteSecret(account(id, key));
  const values = await readFallback(id);
  delete values[key];
  return writeFallback(id, values);
}

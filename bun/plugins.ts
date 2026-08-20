import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { iconIsImage, imageType, parseManifest, parseRegistry, pluginFiles } from '../src/plugin/manifest';
import type { InstalledPlugin, PluginManifest, RegistryIndex } from '../src/plugin/manifest';

const ROOT = join(homedir(), '.dsmx', 'plugins');
const STATE = join(ROOT, 'state.json');

const REGISTRY_INDEX = 'https://raw.githubusercontent.com/KingJayan/dsmx-registry/main/index.json';
const REGISTRY_RAW = 'https://raw.githubusercontent.com/KingJayan/dsmx-registry/main';

const MAX_FILE = 512 * 1024;

export type PluginResult<T> = ({ ok: true } & T) | { ok: false; message: string };

async function readState(): Promise<Record<string, boolean>> {
  try {
    const raw = JSON.parse(await readFile(STATE, 'utf-8')) as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, boolean> = {};
    for (const [id, on] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof on === 'boolean') out[id] = on;
    }
    return out;
  } catch {
    return {};
  }
}

async function writeState(state: Record<string, boolean>): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  await writeFile(STATE, JSON.stringify(state, null, 2), 'utf-8');
}

async function readIfPresent(dir: string, name: string | undefined): Promise<string | null> {
  if (!name) return null;
  try {
    const text = await readFile(join(dir, name), 'utf-8');
    return text.length > MAX_FILE ? null : text;
  } catch {
    return null;
  }
}

async function readPlugin(id: string, enabled: boolean): Promise<InstalledPlugin | null> {
  const dir = join(ROOT, id);
  const raw = await readIfPresent(dir, 'plugin.json');
  if (!raw) return null;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }

  const manifest = parseManifest(parsed);
  if (!manifest || manifest.id !== id) return null;

  return {
    manifest,
    main: await readIfPresent(dir, manifest.main),
    lib: await readIfPresent(dir, manifest.lib),
    readme: await readIfPresent(dir, 'README.md'),
    enabled,
  };
}

export async function listPlugins(): Promise<InstalledPlugin[]> {
  const state = await readState();
  let entries: string[];
  try {
    entries = (await readdir(ROOT, { withFileTypes: true }))
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {
    return [];
  }

  const plugins = await Promise.all(entries.map(id => readPlugin(id, state[id] !== false)));
  return plugins
    .filter((p): p is InstalledPlugin => p !== null)
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export async function setPluginEnabled(id: string, enabled: boolean): Promise<PluginResult<object>> {
  const state = await readState();
  state[id] = enabled;
  try {
    await writeState(state);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: `Could not save the plugin state: ${String(err)}` };
  }
}

export async function uninstallPlugin(id: string): Promise<PluginResult<object>> {
  const manifest = await readPlugin(id, true);
  if (!manifest) return { ok: false, message: `'${id}' is not installed` };
  try {
    await rm(join(ROOT, id), { recursive: true, force: true });
    const state = await readState();
    delete state[id];
    await writeState(state);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: `Could not remove '${id}': ${String(err)}` };
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchRegistry(): Promise<PluginResult<{ index: RegistryIndex }>> {
  try {
    return { ok: true, index: parseRegistry(await getJson(REGISTRY_INDEX)) };
  } catch (err) {
    return { ok: false, message: `Could not reach the marketplace: ${String(err)}` };
  }
}

async function getText(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  return text.length > MAX_FILE ? null : text;
}

export async function installPlugin(id: string): Promise<PluginResult<{ plugin: InstalledPlugin }>> {
  const registry = await fetchRegistry();
  if (!registry.ok) return registry;

  const entry = registry.index.plugins.find(p => p.manifest.id === id);
  if (!entry) return { ok: false, message: `The marketplace does not list '${id}'` };

  const base = `${REGISTRY_RAW}/${entry.path}`;
  const files = new Map<string, string>();
  for (const name of pluginFiles(entry.manifest)) {
    const text = await getText(`${base}/${name}`);
    if (text !== null) files.set(name, text);
  }

  const shipped = files.get('plugin.json');
  const manifest: PluginManifest | null = shipped ? parseManifest(safeJson(shipped)) : null;
  if (!manifest || manifest.id !== id) {
    return { ok: false, message: `'${id}' does not carry a manifest this version can read` };
  }
  if (manifest.main && !files.has(manifest.main)) {
    return { ok: false, message: `'${id}' names ${manifest.main} but does not ship it` };
  }

  const dir = join(ROOT, id);
  try {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    for (const [name, text] of files) {
      const target = join(dir, name);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, text, 'utf-8');
    }
  } catch (err) {
    return { ok: false, message: `Could not write '${id}': ${String(err)}` };
  }

  const state = await readState();
  state[id] = true;
  await writeState(state);

  const plugin = await readPlugin(id, true);
  if (!plugin) return { ok: false, message: `'${id}' did not install cleanly` };
  return { ok: true, plugin };
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

const MAX_ICON = 256 * 1024;

function dataUri(type: string, bytes: Uint8Array): string {
  return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
}

async function registryEntry(id: string): Promise<{ base: string; manifest: PluginManifest } | null> {
  const registry = await fetchRegistry();
  if (!registry.ok) return null;
  const entry = registry.index.plugins.find(p => p.manifest.id === id);
  return entry ? { base: `${REGISTRY_RAW}/${entry.path}`, manifest: entry.manifest } : null;
}

export async function pluginIcon(id: string): Promise<string | null> {
  const local = await readPlugin(id, true);
  const manifest = local?.manifest ?? (await registryEntry(id))?.manifest ?? null;
  if (!manifest || !iconIsImage(manifest.icon)) return null;

  const type = imageType(manifest.icon!);
  if (!type) return null;

  if (local) {
    try {
      const bytes = await readFile(join(ROOT, id, manifest.icon!));
      return bytes.length > MAX_ICON ? null : dataUri(type, bytes);
    } catch {
      return null;
    }
  }

  const entry = await registryEntry(id);
  if (!entry) return null;
  try {
    const res = await fetch(`${entry.base}/${manifest.icon!}`);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > MAX_ICON ? null : dataUri(type, bytes);
  } catch {
    return null;
  }
}

export async function pluginReadme(id: string): Promise<string | null> {
  const local = await readPlugin(id, true);
  if (local?.readme) return local.readme;

  const entry = await registryEntry(id);
  if (!entry) return null;
  return getText(`${entry.base}/README.md`);
}

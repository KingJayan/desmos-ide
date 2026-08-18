
export interface PluginTheme {
  dark: boolean;
  editor: Record<string, string>;
  tokens: Record<string, string>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  homepage?: string;
  keywords?: string[];
  main?: string;
  lib?: string;
  theme?: PluginTheme;
  icon?: string;
}

const IMAGE = /\.(?:png|svg|webp)$/i;

export function iconIsImage(icon: string | undefined): boolean {
  return !!icon && IMAGE.test(icon);
}

export const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export function imageType(path: string): string | null {
  const ext = /\.([a-z]+)$/i.exec(path)?.[1]?.toLowerCase();
  return (ext && IMAGE_TYPES[ext]) ?? null;
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  main: string | null;
  lib: string | null;
  readme: string | null;
  enabled: boolean;
}

export interface PluginState {
  global: Record<string, unknown>;
  workspace: Record<string, unknown>;
  storagePath: string | null;
  globalStoragePath: string | null;
}

export interface RegistryEntry {
  manifest: PluginManifest;
  path: string;
  updated?: string;
}

export interface RegistryIndex {
  version: 1;
  plugins: RegistryEntry[];
}

const ID = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i;

const REL_PATH = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i;

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
}

function relPath(v: unknown): string | null {
  const s = str(v, 128);
  return s && REL_PATH.test(s) && !s.includes('..') ? s : null;
}

function colorMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    if (/^[a-zA-Z][\w.]{0,63}$/.test(key) && typeof value === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(value)) {
      out[key] = value;
    }
  }
  return out;
}

function theme(v: unknown): PluginTheme | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const t = v as Record<string, unknown>;
  const editor = colorMap(t['editor']);
  const tokens = colorMap(t['tokens']);
  if (Object.keys(editor).length === 0 && Object.keys(tokens).length === 0) return undefined;
  return { dark: t['dark'] !== false, editor, tokens };
}

export function parseManifest(raw: unknown): PluginManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;

  const id = str(m['id'], 40);
  if (!id || !ID.test(id)) return null;
  const version = str(m['version'], 32);
  if (!version || !SEMVER.test(version)) return null;
  const name = str(m['name'], 60);
  const description = str(m['description'], 300);
  const author = str(m['author'], 80);
  if (!name || !description || !author) return null;

  const keywords = Array.isArray(m['keywords'])
    ? m['keywords'].filter((k): k is string => typeof k === 'string' && k.length <= 32).slice(0, 8)
    : undefined;

  const manifest: PluginManifest = { id, name, version, description, author };
  const license = str(m['license'], 40);
  if (license) manifest.license = license;
  const homepage = str(m['homepage'], 200);
  if (homepage && /^https:\/\//.test(homepage)) manifest.homepage = homepage;
  if (keywords?.length) manifest.keywords = keywords;
  const main = relPath(m['main']);
  if (main) manifest.main = main;
  const lib = relPath(m['lib']);
  if (lib) manifest.lib = lib;
  const t = theme(m['theme']);
  if (t) manifest.theme = t;

  const icon = str(m['icon'], 128);
  if (icon && iconIsImage(icon)) {
    const path = relPath(icon);
    if (path) manifest.icon = path;
  } else if (icon && icon.length <= 8) {
    manifest.icon = icon;
  }

  return manifest;
}

export function parseRegistry(raw: unknown): RegistryIndex {
  const empty: RegistryIndex = { version: 1, plugins: [] };
  if (!raw || typeof raw !== 'object') return empty;
  const list = (raw as Record<string, unknown>)['plugins'];
  if (!Array.isArray(list)) return empty;

  const seen = new Set<string>();
  const plugins: RegistryEntry[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const entry = row as Record<string, unknown>;
    const manifest = parseManifest(entry['manifest'] ?? entry);
    if (!manifest || seen.has(manifest.id)) continue;
    const path = relPath(entry['path']) ?? manifest.id;
    seen.add(manifest.id);
    const parsed: RegistryEntry = { manifest, path };
    const updated = str(entry['updated'], 40);
    if (updated) parsed.updated = updated;
    plugins.push(parsed);
  }
  return { version: 1, plugins };
}

export function pluginFiles(manifest: PluginManifest): string[] {
  const files = ['plugin.json', 'README.md'];
  if (manifest.main) files.push(manifest.main);
  if (manifest.lib) files.push(manifest.lib);
  if (iconIsImage(manifest.icon)) files.push(manifest.icon!);
  return [...new Set(files)];
}

import type { InstalledPlugin, RegistryEntry } from '../../src/plugin/manifest';

/** what the plugin ui is allowed to do. main.ts supplies it, so neither the panel nor
 * the page reaches the bridge or the host on its own */
export interface PluginActions {
  installed(): InstalledPlugin[];
  registry(): RegistryEntry[];
  loadError(id: string): string | null;
  install(id: string): Promise<void>;
  uninstall(id: string): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  openPage(id: string): void;
  openExternal(url: string): void;
  refreshRegistry(): Promise<void>;
}

export type PluginView = { manifest: RegistryEntry['manifest']; installed: boolean; enabled: boolean };

/** the installed copy wins, since that is the one the app actually runs */
export function mergeViews(installed: InstalledPlugin[], registry: RegistryEntry[]): PluginView[] {
  const views = new Map<string, PluginView>();
  for (const entry of registry) {
    views.set(entry.manifest.id, { manifest: entry.manifest, installed: false, enabled: false });
  }
  for (const plugin of installed) {
    views.set(plugin.manifest.id, { manifest: plugin.manifest, installed: true, enabled: plugin.enabled });
  }
  return [...views.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export function matches(view: PluginView, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const m = view.manifest;
  return [m.name, m.id, m.description, m.author, ...(m.keywords ?? [])]
    .some(field => field.toLowerCase().includes(q));
}

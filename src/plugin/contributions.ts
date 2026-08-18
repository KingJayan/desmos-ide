// what a plugin is allowed to do

export type Widget =
  | { kind: 'label'; text: string; muted?: boolean }
  | { kind: 'button'; id: string; label: string; primary?: boolean }
  | { kind: 'input'; id: string; label?: string; value?: string; placeholder?: string }
  | { kind: 'slider'; id: string; label?: string; value: number; min: number; max: number; step?: number }
  | { kind: 'checkbox'; id: string; label: string; value?: boolean }
  | { kind: 'select'; id: string; label?: string; value?: string; options: SelectOption[] }
  | { kind: 'rows'; rows: Row[] }
  | { kind: 'separator' };

export interface SelectOption { value: string; label: string }
export interface Row { id?: string; title: string; detail?: string }

export interface View {
  id: string;
  title: string;
  widgets: Widget[];
}

export interface StatusItem {
  id: string;
  text: string;
  tooltip?: string;
  command?: string;
}

export interface Keybinding {
  key: string;
  command: string;
}

export const MENU_AREAS = ['editor', 'graph', 'expressions', 'plugins'] as const;
export type MenuArea = (typeof MENU_AREAS)[number];

export interface MenuItem {
  area: MenuArea;
  command: string;
  label: string;
}

export interface CommandInfo {
  plugin: string;
  id: string;
  label: string;
  description?: string;
}

export interface Contributions {
  plugin: string;
  views: View[];
  status: StatusItem[];
  keys: Keybinding[];
  menus: MenuItem[];
}

export function emptyContributions(plugin: string): Contributions {
  return { plugin, views: [], status: [], keys: [], menus: [] };
}

const ID = /^[a-z][a-z0-9_-]{0,39}$/i;
const LIMITS = { views: 8, widgets: 40, rows: 60, options: 40, status: 4, keys: 12, menus: 12 };

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v.slice(0, max) : null;
}

function id(v: unknown): string | null {
  const s = str(v, 40);
  return s && ID.test(s) ? s : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function list(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

function widget(raw: unknown): Widget | null {
  const w = obj(raw);
  if (!w) return null;

  switch (w['kind']) {
    case 'separator':
      return { kind: 'separator' };

    case 'label': {
      const text = str(w['text'], 400);
      return text ? { kind: 'label', text, ...(bool(w['muted']) ? { muted: true } : {}) } : null;
    }

    case 'button': {
      const wid = id(w['id']);
      const label = str(w['label'], 60);
      if (!wid || !label) return null;
      return { kind: 'button', id: wid, label, ...(bool(w['primary']) ? { primary: true } : {}) };
    }

    case 'input': {
      const wid = id(w['id']);
      if (!wid) return null;
      const out: Widget = { kind: 'input', id: wid };
      const label = str(w['label'], 60);
      if (label) out.label = label;
      const value = str(w['value'], 400);
      if (value) out.value = value;
      const placeholder = str(w['placeholder'], 60);
      if (placeholder) out.placeholder = placeholder;
      return out;
    }

    case 'slider': {
      const wid = id(w['id']);
      const min = num(w['min']);
      const max = num(w['max']);
      const value = num(w['value']);
      if (!wid || min === null || max === null || value === null || max <= min) return null;
      const out: Widget = { kind: 'slider', id: wid, value: Math.min(Math.max(value, min), max), min, max };
      const label = str(w['label'], 60);
      if (label) out.label = label;
      const step = num(w['step']);
      if (step !== null && step > 0) out.step = step;
      return out;
    }

    case 'checkbox': {
      const wid = id(w['id']);
      const label = str(w['label'], 60);
      if (!wid || !label) return null;
      return { kind: 'checkbox', id: wid, label, value: bool(w['value']) ?? false };
    }

    case 'select': {
      const wid = id(w['id']);
      if (!wid) return null;
      const options: SelectOption[] = [];
      for (const raw of list(w['options'], LIMITS.options)) {
        const o = obj(raw);
        const value = str(o?.['value'], 60);
        if (!value) continue;
        options.push({ value, label: str(o?.['label'], 60) ?? value });
      }
      if (options.length === 0) return null;
      const out: Widget = { kind: 'select', id: wid, options };
      const label = str(w['label'], 60);
      if (label) out.label = label;
      const value = str(w['value'], 60);
      if (value && options.some(o => o.value === value)) out.value = value;
      return out;
    }

    case 'rows': {
      const rows: Row[] = [];
      for (const raw of list(w['rows'], LIMITS.rows)) {
        const r = obj(raw);
        const title = str(r?.['title'], 120);
        if (!title) continue;
        const row: Row = { title };
        const rid = id(r?.['id']);
        if (rid) row.id = rid;
        const detail = str(r?.['detail'], 200);
        if (detail) row.detail = detail;
        rows.push(row);
      }
      return rows.length ? { kind: 'rows', rows } : null;
    }

    default:
      return null;
  }
}

function view(raw: unknown): View | null {
  const v = obj(raw);
  if (!v) return null;
  const vid = id(v['id']);
  const title = str(v['title'], 60);
  if (!vid || !title) return null;

  const widgets: Widget[] = [];
  const seen = new Set<string>();
  for (const item of list(v['widgets'], LIMITS.widgets)) {
    const w = widget(item);
    if (!w) continue;
    if ('id' in w) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
    }
    widgets.push(w);
  }
  return { id: vid, title, widgets };
}

function statusItem(raw: unknown): StatusItem | null {
  const s = obj(raw);
  if (!s) return null;
  const sid = id(s['id']);
  const text = str(s['text'], 40);
  if (!sid || !text) return null;
  const out: StatusItem = { id: sid, text };
  const tooltip = str(s['tooltip'], 120);
  if (tooltip) out.tooltip = tooltip;
  const command = id(s['command']);
  if (command) out.command = command;
  return out;
}

const KEY_PART = /^(?:[a-z0-9]|f[1-9]|f1[0-2])$/i;
const MODIFIERS = ['alt', 'shift', 'ctrl', 'meta'];

export function parseKey(raw: unknown): string | null {
  const text = str(raw, 40);
  if (!text) return null;

  const parts = text.split('+').map(p => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length < 2) return null;

  const base = parts[parts.length - 1]!;
  const mods = parts.slice(0, -1);
  if (!KEY_PART.test(base)) return null;
  if (mods.some(m => !MODIFIERS.includes(m))) return null;
  if (new Set(mods).size !== mods.length) return null;
  if (!mods.includes('alt')) return null;

  const order = MODIFIERS.filter(m => mods.includes(m));
  return [...order, base].join('+');
}

function keybinding(raw: unknown): Keybinding | null {
  const k = obj(raw);
  if (!k) return null;
  const key = parseKey(k['key']);
  const command = id(k['command']);
  return key && command ? { key, command } : null;
}

function menuItem(raw: unknown): MenuItem | null {
  const m = obj(raw);
  if (!m) return null;
  const area = m['area'];
  const command = id(m['command']);
  const label = str(m['label'], 60);
  if (!command || !label) return null;
  if (typeof area !== 'string' || !MENU_AREAS.includes(area as MenuArea)) return null;
  return { area: area as MenuArea, command, label };
}

function unique<T>(items: (T | null)[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item) continue;
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function parseContributions(plugin: string, raw: unknown): Contributions {
  const c = obj(raw) ?? {};
  return {
    plugin,
    views: unique(list(c['views'], LIMITS.views).map(view), v => v.id),
    status: unique(list(c['status'], LIMITS.status).map(statusItem), s => s.id),
    keys: unique(list(c['keys'], LIMITS.keys).map(keybinding), k => k.key),
    menus: unique(list(c['menus'], LIMITS.menus).map(menuItem), m => `${m.area}:${m.command}`),
  };
}

export function resolveKeys(all: Contributions[]): { owned: Map<string, { plugin: string; command: string }>; clashes: Map<string, string[]> } {
  const owned = new Map<string, { plugin: string; command: string }>();
  const clashes = new Map<string, string[]>();
  for (const c of all) {
    for (const k of c.keys) {
      const held = owned.get(k.key);
      if (held) {
        clashes.set(c.plugin, [...(clashes.get(c.plugin) ?? []), k.key]);
        continue;
      }
      owned.set(k.key, { plugin: c.plugin, command: k.command });
    }
  }
  return { owned, clashes };
}

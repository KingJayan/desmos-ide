export interface KeybindRule {
  key: string;
  command: string;
}

const ALIASES: Record<string, string> = {
  meta: 'cmd',
  command: 'cmd',
  mod: 'cmd',
  control: 'ctrl',
  option: 'alt',
  esc: 'escape',
  return: 'enter',
  ' ': 'space',
};

const MOD_ORDER = ['cmd', 'ctrl', 'alt', 'shift'];
const MOD_SYMBOLS: Record<string, string> = { cmd: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧' };
const KEY_SYMBOLS: Record<string, string> = {
  escape: 'esc', enter: '↩', space: '␣', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
};

function normalizePart(part: string): string {
  const lower = part.trim().toLowerCase();
  return ALIASES[lower] ?? lower;
}

export function normalizeChord(raw: string): string | null {
  const parts = raw.split('+').map(normalizePart).filter(Boolean);
  if (parts.length === 0) return null;
  const mods = new Set(parts.filter(p => MOD_ORDER.includes(p)));
  const keys = parts.filter(p => !MOD_ORDER.includes(p));
  if (keys.length !== 1 || !keys[0]) return null;
  return [...MOD_ORDER.filter(m => mods.has(m)), keys[0]].join('+');
}

export function chordOf(e: KeyboardEvent): string | null {
  const key = normalizePart(e.key);
  if (!key || MOD_ORDER.includes(key)) return null;
  const parts: string[] = [];
  if (e.metaKey) parts.push('cmd');
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(key);
  return parts.join('+');
}

export function chordLabel(chord: string): string {
  const parts = chord.split('+');
  const key = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1).map(m => MOD_SYMBOLS[m] ?? m).join('');
  const shown = KEY_SYMBOLS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  return mods + shown;
}

export const DEFAULT_KEYBINDS: readonly KeybindRule[] = [
  { key: 'cmd+n', command: 'file.new' },
  { key: 'cmd+o', command: 'file.open' },
  { key: 'cmd+s', command: 'file.save' },
  { key: 'cmd+shift+s', command: 'file.saveas' },
  { key: 'cmd+shift+t', command: 'file.exporttex' },
  { key: 'cmd+shift+e', command: 'graph.export-png' },
  { key: 'cmd+f', command: 'editor.find' },
  { key: 'cmd+h', command: 'editor.replace' },
  { key: 'cmd+shift+h', command: 'editor.replace' },
  { key: 'cmd+alt+r', command: 'editor.find-regex' },
  { key: 'cmd+shift+f', command: 'file.search' },
  { key: 'cmd+shift+p', command: 'palette.toggle' },
  { key: 'f1', command: 'palette.toggle' },
  { key: 'cmd+1', command: 'sidebar.git' },
  { key: 'cmd+2', command: 'sidebar.outline' },
  { key: 'cmd+3', command: 'tool.problems' },
  { key: 'cmd+4', command: 'tool.timeline' },
  { key: 'cmd+5', command: 'sidebar.ai' },
  { key: 'cmd+6', command: 'tool.optimizer' },
  { key: 'cmd+7', command: 'sidebar.plugins' },
  { key: 'cmd+,', command: 'preferences.open' },
];

export function parseKeybinds(text: string): KeybindRule[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const rules: KeybindRule[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { key, command } = entry as { key?: unknown; command?: unknown };
    if (typeof key !== 'string' || typeof command !== 'string' || !command) continue;
    const chord = normalizeChord(key);
    if (chord) rules.push({ key: chord, command });
  }
  return rules;
}

export function keybindsToJson(rules: readonly KeybindRule[]): string {
  return JSON.stringify(rules.map(r => ({ key: r.key, command: r.command })), null, 2) + '\n';
}

export class Keymap {
  private byChord = new Map<string, string>();
  private byCommand = new Map<string, string>();

  constructor() {
    this.apply([]);
  }

  apply(user: readonly KeybindRule[]): void {
    this.byChord.clear();
    this.byCommand.clear();
    for (const rule of [...DEFAULT_KEYBINDS, ...user]) {
      const chord = normalizeChord(rule.key);
      if (!chord) continue;
      if (!rule.command || rule.command === '-') this.byChord.delete(chord);
      else this.byChord.set(chord, rule.command);
    }
    for (const [chord, command] of this.byChord) {
      if (!this.byCommand.has(command)) this.byCommand.set(command, chord);
    }
  }

  commandFor(chord: string): string | null {
    return this.byChord.get(chord) ?? null;
  }

  labelFor(command: string): string | null {
    const chord = this.byCommand.get(command);
    return chord ? chordLabel(chord) : null;
  }
}

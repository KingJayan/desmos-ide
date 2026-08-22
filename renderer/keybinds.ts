import { isMac } from './platform';

export interface KeybindRule {
  key: string;
  command: string;
}

const ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  ' ': 'space',
};

const MAC_MODS: Record<string, string> = {
  cmd: 'mod', command: 'mod', meta: 'mod', mod: 'mod',
  ctrl: 'ctrl', control: 'ctrl',
  alt: 'alt', option: 'alt',
  shift: 'shift',
};

const PC_MODS: Record<string, string> = {
  cmd: 'mod', command: 'mod', meta: 'mod', mod: 'mod',
  ctrl: 'mod', control: 'mod',
  alt: 'alt',  option: 'alt',
  shift: 'shift',
};

const MOD_ORDER = ['mod', 'ctrl', 'alt', 'shift'];
const MAC_SYMBOLS: Record<string, string> = { mod: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧' };
const PC_SYMBOLS: Record<string, string> = { mod: 'Ctrl+', ctrl: 'Ctrl+', alt: 'Alt+', shift: 'Shift+' };
const KEY_SYMBOLS: Record<string, string> = {
  escape: 'esc', enter: '↩', space: '␣', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
};

function normalizePart(part: string): string {
  const lower = part.trim().toLowerCase();
  const mods = isMac() ? MAC_MODS : PC_MODS;
  return mods[lower] ?? ALIASES[lower] ?? lower;
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
  if (isMac()) {
    if (e.metaKey) parts.push('mod');
    if (e.ctrlKey) parts.push('ctrl');
  } else {
    if (e.metaKey) return null;
    if (e.ctrlKey) parts.push('mod');
  }
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(key);
  return parts.join('+');
}

export function chordLabel(chord: string): string {
  const parts = chord.split('+');
  const key = parts[parts.length - 1] ?? '';
  const symbols = isMac() ? MAC_SYMBOLS : PC_SYMBOLS;
  const mods = parts.slice(0, -1).map(m => symbols[m] ?? m).join('');
  const shown = KEY_SYMBOLS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  return mods + shown;
}

export const DEFAULT_KEYBINDS: readonly KeybindRule[] = [
  { key: 'mod+n', command: 'file.new' },
  { key: 'mod+o', command: 'file.open' },
  { key: 'mod+s', command: 'file.save' },
  { key: 'mod+shift+s', command: 'file.saveas' },
  { key: 'mod+shift+t', command: 'file.exporttex' },
  { key: 'mod+shift+e', command: 'graph.export-png' },
  { key: 'mod+f', command: 'editor.find' },
  { key: 'mod+h', command: 'editor.replace' },
  { key: 'mod+shift+h', command: 'editor.replace' },
  { key: 'mod+alt+r', command: 'editor.find-regex' },
  { key: 'mod+shift+f', command: 'file.search' },
  { key: 'mod+shift+p', command: 'palette.toggle' },
  { key: 'f1', command: 'palette.toggle' },
  { key: 'mod+1', command: 'sidebar.git' },
  { key: 'mod+2', command: 'sidebar.outline' },
  { key: 'mod+3', command: 'tool.problems' },
  { key: 'mod+4', command: 'tool.timeline' },
  { key: 'mod+5', command: 'sidebar.ai' },
  { key: 'mod+6', command: 'tool.optimizer' },
  { key: 'mod+7', command: 'sidebar.plugins' },
  { key: 'mod+,', command: 'preferences.open' },
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

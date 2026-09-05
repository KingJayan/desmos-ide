import { iconEl } from './icons';
import { THEMES, isColorTheme, type ColorTheme } from './themes';

export type { ColorTheme };
export type EditorTheme = ColorTheme | 'auto';

export type UiScale = 'compact' | 'default' | 'large';
export const UI_SCALES = ['compact', 'default', 'large'] as const;

export const GIT_AUTOFETCH_PERIODS = [60, 180, 300, 900] as const;

export interface EditorSettings {
  colorTheme:  ColorTheme;
  editorTheme: EditorTheme;
  uiScale: UiScale;
  simpleMode: boolean;
  reduceMotion: 'auto' | 'on' | 'off';
  showStatusBar: boolean;
  showBreadcrumbs: boolean;
  showTabStrip: boolean;

  fontSize:    number;
  codeFontFamily: string;
  uiFontFamily:   string;

  lineHeight: number;
  fontLigatures: boolean;
  minimap:     boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  wordWrap:    'off' | 'on';
  tabSize: number;
  insertSpaces: boolean;
  cursorStyle: 'line' | 'block' | 'underline';
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  renderWhitespace: 'none' | 'boundary' | 'selection' | 'all';
  smoothScrolling: boolean;
  stickyScroll: boolean;
  bracketPairColorization: boolean;
  indentGuides: boolean;
  inlineSliders: boolean;
  optimizerHints: boolean;
  codeLens: boolean;

  formatOnSave: boolean;
  autosave: boolean;
  autosaveDelay: number;
  restoreSession: boolean;

  graphZoomButtons: boolean;
  graphSettingsMenu: boolean;
  graphKeypad: boolean;
  graphExpressions: boolean;
  graphLockViewport: boolean;

  gitAutofetch: boolean;
  gitAutofetchPeriod: number;
  tourDone: boolean;
}

export const DEFAULTS: EditorSettings = {
  colorTheme:  'dsmx',
  editorTheme: 'auto',
  uiScale: 'default',
  simpleMode: false,
  reduceMotion: 'auto',
  showStatusBar: true,
  showBreadcrumbs: true,
  showTabStrip: true,

  fontSize:    14,
  codeFontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  uiFontFamily:   'Inter, "SF Pro Text", -apple-system, sans-serif',
  lineHeight: 1.6,
  fontLigatures: true,
  minimap:     false,
  lineNumbers: 'on',
  wordWrap:    'on',
  tabSize: 2,
  insertSpaces: true,
  cursorStyle: 'line',
  cursorBlinking: 'smooth',
  renderWhitespace: 'none',
  smoothScrolling: true,
  stickyScroll: false,
  bracketPairColorization: true,
  indentGuides: true,
  inlineSliders: true,
  optimizerHints: true,
  codeLens: true,

  formatOnSave: false,
  autosave: false,
  autosaveDelay: 1200,
  restoreSession: true,

  graphZoomButtons: true,
  graphSettingsMenu: false,
  graphKeypad: false,
  graphExpressions: false,
  graphLockViewport: false,

  gitAutofetch: false,
  gitAutofetchPeriod: 180,
  tourDone: false,
};

const STORAGE_KEY = 'desmos-ide-settings';
const SETTINGS_VERSION = 4;

type BoolKey = { [K in keyof EditorSettings]: EditorSettings[K] extends boolean ? K : never }[keyof EditorSettings];
type NumKey = { [K in keyof EditorSettings]: EditorSettings[K] extends number ? K : never }[keyof EditorSettings];
type StrKey = { [K in keyof EditorSettings]: EditorSettings[K] extends string ? K : never }[keyof EditorSettings];

type Field =
  | { key: BoolKey; kind: 'toggle'; label: string; hint?: string }
  | { key: StrKey; kind: 'select'; label: string; options: readonly { value: string; label: string }[]; hint?: string }
  | { key: NumKey; kind: 'select'; label: string; numeric: true; options: readonly { value: string; label: string }[]; hint?: string }
  | { key: NumKey; kind: 'range'; label: string; min: number; max: number; step: number; unit: string; hint?: string };

interface Group {
  title: string;
  hint?: string;
  fields: readonly Field[];
}

const THEME_OPTIONS = THEMES.map(t => ({ value: t.id, label: t.label }));
const EDITOR_THEME_OPTIONS = [{ value: 'auto', label: 'same as color theme' }, ...THEME_OPTIONS];

export function resolveEditorTheme(s: EditorSettings): string {
  return s.editorTheme === 'auto' ? s.colorTheme : s.editorTheme;
}

const CODE_FONTS = [
  { value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace', label: 'JetBrains Mono' },
  { value: '"Cascadia Code", Consolas, monospace', label: 'Cascadia Code' },
  { value: '"IBM Plex Mono", Consolas, monospace', label: 'IBM Plex Mono' },
  { value: '"Fira Code", Consolas, monospace', label: 'Fira Code' },
  { value: 'Consolas, monospace', label: 'Consolas' },
  { value: '"SF Mono", monospace', label: 'SF Mono' },
] as const;

const UI_FONTS = [
  { value: 'Inter, "SF Pro Text", -apple-system, sans-serif', label: 'Inter' },
  { value: '"Avenir Next", "SF Pro Text", "Segoe UI", sans-serif', label: 'Avenir Next' },
  { value: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', label: 'Segoe UI' },
  { value: '"SF Pro Text", "Helvetica Neue", Arial, sans-serif', label: 'SF Pro Text' },
  { value: '"IBM Plex Sans", "Segoe UI", sans-serif', label: 'IBM Plex Sans' },
  { value: '"Figtree", "Avenir Next", sans-serif', label: 'Figtree' },
] as const;

export const GROUPS: readonly Group[] = [
  {
    title: 'appearance',
    fields: [
      { key: 'colorTheme', kind: 'select', label: 'color theme', options: THEME_OPTIONS },
      {
        key: 'uiScale', kind: 'select', label: 'interface size',
        options: UI_SCALES.map(s => ({ value: s, label: s })),
        hint: 'Scales the panels, menus and status bar. The editor has its own font size.',
      },
      { key: 'uiFontFamily', kind: 'select', label: 'ui font', options: UI_FONTS },
      {
        key: 'simpleMode', kind: 'toggle', label: 'simple mode',
        hint: 'Hides the rails, the bottom panel, the tab strip and the status facts. Every command stays in the palette.',
      },
      {
        key: 'reduceMotion', kind: 'select', label: 'reduce motion',
        options: [
          { value: 'auto', label: 'follow the system' },
          { value: 'on', label: 'always' },
          { value: 'off', label: 'never' },
        ],
      },
      { key: 'showStatusBar', kind: 'toggle', label: 'status bar' },
      { key: 'showTabStrip', kind: 'toggle', label: 'tab strip' },
      { key: 'showBreadcrumbs', kind: 'toggle', label: 'breadcrumbs' },
    ],
  },
  {
    title: 'editor theme',
    hint: 'Applies to the DSL editor and the Enhanced view',
    fields: [
      {
        key: 'editorTheme', kind: 'select', label: 'syntax theme (override)',
        options: EDITOR_THEME_OPTIONS,
        hint: 'Keep "same as color theme" unless you want the editor to differ from the rest of the app.',
      },
      { key: 'fontSize', kind: 'range', label: 'font size', min: 10, max: 24, step: 1, unit: 'px' },
      { key: 'codeFontFamily', kind: 'select', label: 'code font', options: CODE_FONTS },
      { key: 'lineHeight', kind: 'range', label: 'line height', min: 1.1, max: 2.4, step: 0.1, unit: '×' },
      { key: 'fontLigatures', kind: 'toggle', label: 'ligatures' },
    ],
  },
  {
    title: 'editor',
    fields: [
      {
        key: 'lineNumbers', kind: 'select', label: 'line numbers',
        options: [
          { value: 'on', label: 'on' },
          { value: 'relative', label: 'relative' },
          { value: 'off', label: 'off' },
        ],
      },
      { key: 'minimap', kind: 'toggle', label: 'minimap' },
      { key: 'wordWrap', kind: 'select', label: 'word wrap', options: [{ value: 'off', label: 'off' }, { value: 'on', label: 'on' }] },
      {
        key: 'tabSize', kind: 'select', label: 'tab size', numeric: true,
        options: [{ value: '2', label: '2' }, { value: '4', label: '4' }, { value: '8', label: '8' }],
      },
      { key: 'insertSpaces', kind: 'toggle', label: 'insert spaces' },
      {
        key: 'cursorStyle', kind: 'select', label: 'cursor',
        options: [
          { value: 'line', label: 'line' },
          { value: 'block', label: 'block' },
          { value: 'underline', label: 'underline' },
        ],
      },
      {
        key: 'cursorBlinking', kind: 'select', label: 'cursor blinking',
        options: ['blink', 'smooth', 'phase', 'expand', 'solid'].map(v => ({ value: v, label: v })),
      },
      {
        key: 'renderWhitespace', kind: 'select', label: 'show whitespace',
        options: ['none', 'boundary', 'selection', 'all'].map(v => ({ value: v, label: v })),
      },
      { key: 'indentGuides', kind: 'toggle', label: 'indent guides' },
      { key: 'bracketPairColorization', kind: 'toggle', label: 'bracket pair colors' },
      { key: 'stickyScroll', kind: 'toggle', label: 'sticky scroll' },
      { key: 'smoothScrolling', kind: 'toggle', label: 'smooth scrolling' },
      {
        key: 'inlineSliders', kind: 'toggle', label: 'inline sliders',
        hint: 'Draws a draggable track beside every slider() the file declares.',
      },
      { key: 'optimizerHints', kind: 'toggle', label: 'optimizer hints', hint: 'Notes what the compiler folded, at the end of the line it folded.' },
      { key: 'codeLens', kind: 'toggle', label: 'fix error lens', hint: 'Offers the AI panel an error to explain, above the line that failed.' },
    ],
  },
  {
    title: 'files',
    fields: [
      { key: 'formatOnSave', kind: 'toggle', label: 'format on save' },
      {
        key: 'autosave', kind: 'toggle', label: 'autosave',
        hint: 'Writes the open file after you stop typing. Untitled buffers are never given a file.',
      },
      { key: 'autosaveDelay', kind: 'range', label: 'autosave delay', min: 400, max: 5000, step: 200, unit: 'ms' },
      { key: 'restoreSession', kind: 'toggle', label: 'reopen the last file', hint: 'Off means every launch starts on the start page.' },
    ],
  },
  {
    title: 'graph',
    fields: [
      { key: 'graphZoomButtons', kind: 'toggle', label: 'zoom buttons' },
      { key: 'graphSettingsMenu', kind: 'toggle', label: 'desmos settings menu' },
      { key: 'graphKeypad', kind: 'toggle', label: 'keypad' },
      { key: 'graphExpressions', kind: 'toggle', label: 'desmos expression list', hint: 'The DSL file stays the source of truth either way.' },
      { key: 'graphLockViewport', kind: 'toggle', label: 'lock the viewport' },
    ],
  },
  {
    title: 'git',
    hint: 'Background fetch keeps the ahead/behind count current. It uses the network.',
    fields: [
      { key: 'gitAutofetch', kind: 'toggle', label: 'auto fetch' },
      {
        key: 'gitAutofetchPeriod', kind: 'select', label: 'fetch every', numeric: true,
        options: [
          { value: '60', label: '1 minute' },
          { value: '180', label: '3 minutes' },
          { value: '300', label: '5 minutes' },
          { value: '900', label: '15 minutes' },
        ],
      },
    ],
  },
];

const FIELDS: readonly Field[] = GROUPS.flatMap(g => g.fields);

function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const v = typeof raw.__v === 'number' ? raw.__v : 1;
  const hadEditorTheme = raw.editorTheme;
  const hadColorTheme = raw.colorTheme;
  if (v < 2) {
    if (raw.theme && !raw.editorTheme) { raw.editorTheme = raw.theme; delete raw.theme; }
    if (raw.fontFamily && !raw.codeFontFamily) { raw.codeFontFamily = raw.fontFamily; delete raw.fontFamily; }
    if (raw.colorTheme && !raw.editorTheme) raw.editorTheme = raw.colorTheme;
    if (raw.editorTheme && !raw.colorTheme) raw.colorTheme = raw.editorTheme;
    if (raw.colorTheme === 'dark') raw.colorTheme = 'catppuccin-mocha';
  }
  if (v < 3) {
    for (const key of ['colorTheme', 'editorTheme']) {
      if (raw[key] === 'desmos-dark') raw[key] = 'catppuccin-mocha';
    }
  }
  if (v < 4) {
    if (hadEditorTheme === undefined || hadEditorTheme === hadColorTheme) raw.editorTheme = 'auto';
  }
  raw.__v = SETTINGS_VERSION;
  return raw;
}

const round = (value: number, step: number): number =>
  Math.round(Math.round(value / step) * step * 1000) / 1000;

function validate(raw: Record<string, unknown>): EditorSettings {
  const out = { ...DEFAULTS };
  for (const field of FIELDS) {
    const value = raw[field.key];
    if (field.kind === 'toggle') {
      if (typeof value === 'boolean') out[field.key] = value;
      continue;
    }
    if (field.kind === 'range') {
      const n = Number(value);
      if (Number.isFinite(n)) {
        out[field.key] = round(Math.min(field.max, Math.max(field.min, n)), field.step);
      }
      continue;
    }
    if ('numeric' in field) {
      if (field.options.some(o => Number(o.value) === Number(value))) out[field.key] = Number(value);
      continue;
    }
    if (field.options.some(o => o.value === value)) out[field.key] = value as never;
  }

  if (isColorTheme(raw.colorTheme)) out.colorTheme = raw.colorTheme;
  if (raw.editorTheme === 'auto') {
    out.editorTheme = 'auto';
  } else if (typeof raw.editorTheme === 'string' && raw.editorTheme.startsWith('plugin-')) {
    out.editorTheme = raw.editorTheme as EditorTheme;
  } else if (isColorTheme(raw.editorTheme)) {
    out.editorTheme = raw.editorTheme;
  }
  if (typeof raw.tourDone === 'boolean') out.tourDone = raw.tourDone;
  return out;
}

/** settings.json storage */
export function loadSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ...DEFAULTS };
    return validate(migrate(parsed as Record<string, unknown>));
  } catch {
    return { ...DEFAULTS };
  }
}

export function settingsFromJson(text: string): EditorSettings | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return validate(migrate(parsed as Record<string, unknown>));
  } catch {
    return null;
  }
}

export function settingsToJson(s: EditorSettings): string {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULTS).sort()) ordered[key] = s[key as keyof EditorSettings];
  return JSON.stringify(ordered, null, 2) + '\n';
}

function saveSettings(s: EditorSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  void window.electronAPI?.configWrite('settings', settingsToJson(s));
}

export interface ExtraTheme { id: string; label: string }

export class SettingsPanel {
  private overlay: HTMLElement;
  private modal: HTMLElement;
  private extraThemes: ExtraTheme[] = [];
  private settings: EditorSettings;
  private onChange: (s: EditorSettings) => void;
  private previousFocus: HTMLElement | null = null;
  private controls = new Map<keyof EditorSettings, () => void>();
  private editorThemeEl: HTMLSelectElement | null = null;
  private openJson?: (file: 'settings' | 'keybinds') => void;
  private rows = new Map<keyof EditorSettings, HTMLElement>();
  private searchEl: HTMLInputElement | null = null;

  constructor(onChange: (s: EditorSettings) => void, openJson?: (file: 'settings' | 'keybinds') => void) {
    this.settings = loadSettings();
    this.onChange = onChange;
    this.openJson = openJson;
    const built = this.build();
    this.overlay = built.overlay;
    this.modal = built.modal;
    document.body.appendChild(this.overlay);
  }

  setExtraThemes(themes: ExtraTheme[]): void {
    this.extraThemes = themes;
    const select = this.editorThemeEl;
    if (!select) return;

    select.querySelector('#s-plugin-themes')?.remove();
    if (themes.length === 0) return;

    const group = document.createElement('optgroup');
    group.id = 's-plugin-themes';
    group.label = 'from plugins';
    for (const theme of themes) {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.label;
      group.appendChild(option);
    }
    select.appendChild(group);
    select.value = this.settings.editorTheme;
  }

  private emit(): void {
    saveSettings(this.settings);
    this.onChange({ ...this.settings });
  }

  private hintRow(text: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row settings-hint-row';
    const hint = document.createElement('span');
    hint.className = 'settings-hint';
    hint.textContent = text;
    row.appendChild(hint);
    return row;
  }

  private buildField(field: Field): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row';
    row.dataset['search'] = `${field.label} ${field.key} ${field.hint ?? ''}`.toLowerCase();
    const id = `s-${field.key}`;
    this.rows.set(field.key, row);

    const label = document.createElement('label');
    label.className = 'settings-label';
    label.htmlFor = id;
    label.textContent = field.label;

    const dot = document.createElement('span');
    dot.className = 'settings-modified';
    dot.setAttribute('aria-hidden', 'true');

    const reset = document.createElement('button');
    reset.className = 'settings-reset';
    reset.type = 'button';
    reset.title = `Reset ${field.label} to the default`;
    reset.setAttribute('aria-label', `Reset ${field.label} to the default`);
    reset.appendChild(iconEl('rotate-ccw', { size: 12 }));
    reset.addEventListener('click', () => {
      (this.settings[field.key] as EditorSettings[typeof field.key]) = DEFAULTS[field.key];
      this.emit();
      this.syncControls();
    });

    row.append(label, dot, reset);

    if (field.kind === 'toggle') {
      const wrap = document.createElement('label');
      wrap.className = 'settings-toggle';
      wrap.setAttribute('aria-label', field.label);
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.className = 'settings-toggle-input';
      const track = document.createElement('span');
      track.className = 'settings-toggle-track';
      track.setAttribute('aria-hidden', 'true');
      wrap.append(input, track);
      row.appendChild(wrap);

      input.addEventListener('change', () => {
        this.settings[field.key] = input.checked;
        this.emit();
      });
      this.controls.set(field.key, () => { input.checked = this.settings[field.key]; });
      return row;
    }

    if (field.kind === 'range') {
      const wrap = document.createElement('div');
      wrap.className = 'settings-range-wrap';
      const input = document.createElement('input');
      input.type = 'range';
      input.id = id;
      input.className = 'settings-range';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      const value = document.createElement('input');
      value.type = 'number';
      value.className = 'settings-range-val';
      value.min = String(field.min);
      value.max = String(field.max);
      value.step = String(field.step);
      value.setAttribute('aria-label', `${field.label} in ${field.unit}`);
      const unit = document.createElement('span');
      unit.className = 'settings-range-unit';
      unit.textContent = field.unit;
      wrap.append(input, value, unit);
      row.appendChild(wrap);

      const take = (raw: number) => {
        if (!Number.isFinite(raw)) return;
        this.settings[field.key] = Math.min(field.max, Math.max(field.min, raw));
        this.emit();
        this.syncControls();
      };
      input.addEventListener('input', () => take(Number(input.value)));
      value.addEventListener('change', () => take(Number(value.value)));
      this.controls.set(field.key, () => {
        input.value = String(this.settings[field.key]);
        value.value = String(this.settings[field.key]);
      });
      return row;
    }

    const select = document.createElement('select');
    select.className = 'settings-select';
    select.id = id;
    for (const option of field.options) {
      const el = document.createElement('option');
      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    }
    row.appendChild(select);
    if (field.key === 'editorTheme') this.editorThemeEl = select;

    const numeric = 'numeric' in field;
    select.addEventListener('change', () => {
      if (numeric) (this.settings[field.key] as number) = Number(select.value);
      else (this.settings[field.key] as string) = select.value;
      this.emit();
    });
    this.controls.set(field.key, () => { select.value = String(this.settings[field.key]); });
    return row;
  }

  private build(): { overlay: HTMLElement; modal: HTMLElement } {
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'settings-dialog-title');

    const modal = document.createElement('div');
    modal.className = 'settings-modal';

    const header = document.createElement('div');
    header.className = 'settings-header';
    const title = document.createElement('span');
    title.className = 'settings-title';
    title.id = 'settings-dialog-title';
    title.textContent = 'Settings';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'settings-search';
    search.placeholder = 'Search settings';
    search.setAttribute('aria-label', 'Search settings');
    search.addEventListener('input', () => this.applySearch());
    this.searchEl = search;

    const close = document.createElement('button');
    close.className = 'settings-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close settings');
    close.appendChild(iconEl('x', { size: 14 }));
    close.addEventListener('click', () => this.hide());
    header.append(title, search, close);

    const body = document.createElement('div');
    body.className = 'settings-body';

    for (const group of GROUPS) {
      const section = document.createElement('div');
      section.className = 'settings-group';
      const groupTitle = document.createElement('div');
      groupTitle.className = 'settings-group-title';
      groupTitle.textContent = group.title;
      section.dataset['search'] = group.title.toLowerCase();
      section.appendChild(groupTitle);
      if (group.hint) section.appendChild(this.hintRow(group.hint));
      for (const field of group.fields) {
        section.appendChild(this.buildField(field));
        if (field.hint) section.appendChild(this.hintRow(field.hint));
      }
      body.appendChild(section);
    }

    const footer = document.createElement('div');
    footer.className = 'settings-footer';
    const note = document.createElement('span');
    note.className = 'settings-hint';
    note.textContent = 'Every setting is text in settings.json.';
    const links = document.createElement('span');
    links.className = 'settings-footer-links';
    for (const file of ['settings', 'keybinds'] as const) {
      const link = document.createElement('button');
      link.className = 'settings-link';
      link.type = 'button';
      link.textContent = `${file}.json`;
      link.addEventListener('click', () => { this.hide(); this.openJson?.(file); });
      links.appendChild(link);
    }
    footer.append(note, links);

    modal.append(header, body, footer);
    overlay.appendChild(modal);

    overlay.addEventListener('click', e => { if (e.target === overlay) this.hide(); });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); this.hide(); return; }
      if (e.key === 'Tab') this.trapFocus(e, modal);
    });

    this.syncControls();
    return { overlay, modal };
  }

  private applySearch(): void {
    const term = (this.searchEl?.value ?? '').trim().toLowerCase();
    for (const section of Array.from(this.modal.querySelectorAll<HTMLElement>('.settings-group'))) {
      const inGroup = (section.dataset['search'] ?? '').includes(term);
      let shown = 0;
      for (const row of Array.from(section.querySelectorAll<HTMLElement>('.settings-row'))) {
        if (row.classList.contains('settings-hint-row')) continue;
        const hit = !term || inGroup || (row.dataset['search'] ?? '').includes(term);
        row.classList.toggle('hidden', !hit);
        const hint = row.nextElementSibling;
        if (hint?.classList.contains('settings-hint-row')) hint.classList.toggle('hidden', !hit);
        if (hit) shown++;
      }
      section.classList.toggle('hidden', shown === 0);
    }
  }

  private syncControls(): void {
    for (const sync of this.controls.values()) sync();
    for (const [key, row] of this.rows) {
      row.classList.toggle('settings-row--modified', this.settings[key] !== DEFAULTS[key]);
    }
    const period = this.overlay?.querySelector<HTMLSelectElement>('#s-gitAutofetchPeriod');
    if (period) period.disabled = !this.settings.gitAutofetch;
  }

  private trapFocus(e: KeyboardEvent, modal: HTMLElement): void {
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>('button, input, select, [tabindex]:not([tabindex="-1"])'),
    ).filter(el => !el.hasAttribute('disabled'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  show(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.overlay.classList.remove('hidden');
    this.modal.querySelector<HTMLElement>('button, input, select')?.focus();
  }

  hide(): void {
    this.overlay.classList.add('hidden');
    this.previousFocus?.focus();
    this.previousFocus = null;
  }

  toggle(): void { if (this.overlay.classList.contains('hidden')) this.show(); else this.hide(); }
  current(): EditorSettings { return { ...this.settings }; }

  adopt(next: EditorSettings): void {
    this.settings = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.syncControls();
    this.setExtraThemes(this.extraThemes);
    this.onChange({ ...this.settings });
  }

  patch(part: Partial<EditorSettings>): void {
    this.settings = { ...this.settings, ...part };
    saveSettings(this.settings);
    this.syncControls();
    this.onChange({ ...this.settings });
  }
}

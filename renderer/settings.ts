import { createIcons, X } from 'lucide';

export type ColorTheme =
  | 'desmos-dark'
  | 'catppuccin-latte'
  | 'catppuccin-frappe'
  | 'catppuccin-macchiato'
  | 'github-dark'
  | 'github-light'
  | 'monokai'
  | 'vs-dark'
  | 'vs-light';
export type EditorTheme = 'desmos-dark' | 'catppuccin-latte' | 'catppuccin-frappe' | 'catppuccin-macchiato' | 'github-dark' | 'github-light' | 'monokai' | 'vs-dark' | 'vs-light';

export interface EditorSettings {
  colorTheme:  ColorTheme;
  editorTheme: EditorTheme;
  fontSize:    number;
  codeFontFamily: string;
  uiFontFamily:   string;
  minimap:     boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  wordWrap:    'off' | 'on';
  formatOnSave: boolean;
}

const DEFAULTS: EditorSettings = {
  colorTheme:  'desmos-dark',
  editorTheme: 'desmos-dark',
  fontSize:    14,
  codeFontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  uiFontFamily:   '"Avenir Next", "SF Pro Text", "Segoe UI", sans-serif',
  minimap:     false,
  lineNumbers: 'on',
  wordWrap:    'off',
  formatOnSave: false,
};

const STORAGE_KEY = 'desmos-ide-settings';
const SETTINGS_VERSION = 2;

const VALID_COLOR_THEMES = new Set<ColorTheme>([
  'desmos-dark','catppuccin-latte','catppuccin-frappe','catppuccin-macchiato',
  'github-dark','github-light','monokai','vs-dark','vs-light',
]);
const VALID_LINE_NUMBERS = new Set(['on','off','relative']);
const VALID_WORD_WRAP = new Set(['on','off']);
const VALID_FONTS_CODE = new Set([
  '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  '"Cascadia Code", Consolas, monospace',
  '"Fira Code", Consolas, monospace',
  'Consolas, monospace',
  '"SF Mono", monospace',
]);
const VALID_FONTS_UI = new Set([
  '"Avenir Next", "SF Pro Text", "Segoe UI", sans-serif',
  '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '"SF Pro Text", "Helvetica Neue", Arial, sans-serif',
  '"IBM Plex Sans", "Segoe UI", sans-serif',
  '"Figtree", "Avenir Next", sans-serif',
]);

function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const v = typeof raw.__v === 'number' ? raw.__v : 1;
  if (v < 2) {
    if (raw.theme && !raw.editorTheme) { raw.editorTheme = raw.theme; delete raw.theme; }
    if (raw.fontFamily && !raw.codeFontFamily) { raw.codeFontFamily = raw.fontFamily; delete raw.fontFamily; }
    if (raw.colorTheme && !raw.editorTheme) raw.editorTheme = raw.colorTheme;
    if (raw.editorTheme && !raw.colorTheme) raw.colorTheme = raw.editorTheme;
    if (raw.colorTheme === 'dark') raw.colorTheme = 'desmos-dark';
  }
  raw.__v = SETTINGS_VERSION;
  return raw;
}

function validate(raw: Record<string, unknown>): EditorSettings {
  const d = DEFAULTS;
  const colorTheme = VALID_COLOR_THEMES.has(raw.colorTheme as ColorTheme)
    ? (raw.colorTheme as ColorTheme) : d.colorTheme;
  const editorTheme = VALID_COLOR_THEMES.has(raw.editorTheme as EditorTheme)
    ? (raw.editorTheme as EditorTheme) : d.editorTheme;
  const rawSize = Number(raw.fontSize);
  const fontSize = Number.isFinite(rawSize) ? Math.min(20, Math.max(12, Math.round(rawSize))) : d.fontSize;
  const codeFontFamily = VALID_FONTS_CODE.has(raw.codeFontFamily as string)
    ? (raw.codeFontFamily as string) : d.codeFontFamily;
  const uiFontFamily = VALID_FONTS_UI.has(raw.uiFontFamily as string)
    ? (raw.uiFontFamily as string) : d.uiFontFamily;
  const minimap = typeof raw.minimap === 'boolean' ? raw.minimap : d.minimap;
  const lineNumbers = VALID_LINE_NUMBERS.has(raw.lineNumbers as string)
    ? (raw.lineNumbers as EditorSettings['lineNumbers']) : d.lineNumbers;
  const wordWrap = VALID_WORD_WRAP.has(raw.wordWrap as string)
    ? (raw.wordWrap as EditorSettings['wordWrap']) : d.wordWrap;
  const formatOnSave = typeof raw.formatOnSave === 'boolean' ? raw.formatOnSave : d.formatOnSave;
  return { colorTheme, editorTheme, fontSize, codeFontFamily, uiFontFamily, minimap, lineNumbers, wordWrap, formatOnSave };
}

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

function saveSettings(s: EditorSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export class SettingsPanel {
  private overlay: HTMLElement;
  private settings: EditorSettings;
  private onChange: (s: EditorSettings) => void;
  private previousFocus: HTMLElement | null = null;

  constructor(onChange: (s: EditorSettings) => void) {
    this.settings = loadSettings();
    this.onChange = onChange;
    this.overlay = this.build();
    document.body.appendChild(this.overlay);
    createIcons({
      icons: { X },
      attrs: { 'stroke-width': '2' },
    });
  }

  private build(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'settings-dialog-title');

    overlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <span class="settings-title" id="settings-dialog-title">Settings</span>
          <button class="settings-close" aria-label="Close settings"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div class="settings-body">

          <div class="settings-group">
            <div class="settings-group-title">App Theme</div>

            <div class="settings-row">
              <label class="settings-label">Color Theme</label>
              <select class="settings-select" id="s-color-theme">
                <option value="desmos-dark">Catppuccin Mocha</option>
                <option value="catppuccin-latte">Catppuccin Latte</option>
                <option value="catppuccin-frappe">Catppuccin Frappé</option>
                <option value="catppuccin-macchiato">Catppuccin Macchiato</option>
                <option value="github-dark">GitHub Dark</option>
                <option value="github-light">GitHub Light</option>
                <option value="monokai">Monokai</option>
                <option value="vs-dark">VS Dark</option>
                <option value="vs-light">VS Light</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">Editor Theme</div>
            <div class="settings-row settings-hint-row">
              <span class="settings-hint">Applies to DSL editor and Enhanced view</span>
            </div>

            <div class="settings-row">
              <label class="settings-label">Syntax Theme</label>
              <select class="settings-select" id="s-editor-theme">
                <option value="desmos-dark">Catppuccin Mocha</option>
                <option value="catppuccin-latte">Catppuccin Latte</option>
                <option value="catppuccin-frappe">Catppuccin Frappé</option>
                <option value="catppuccin-macchiato">Catppuccin Macchiato</option>
                <option value="github-dark">GitHub Dark</option>
                <option value="github-light">GitHub Light</option>
                <option value="monokai">Monokai</option>
                <option value="vs-dark">VS Dark</option>
                <option value="vs-light">VS Light</option>
              </select>
            </div>

            <div class="settings-row">
              <label class="settings-label">Font Size</label>
              <div class="settings-range-wrap">
                <input type="range" class="settings-range" id="s-font-size" min="12" max="20" step="1" />
                <span class="settings-range-val" id="s-font-size-val"></span>
              </div>
            </div>

            <div class="settings-row">
              <label class="settings-label">UI Font</label>
              <select class="settings-select" id="s-ui-font-family">
                <option value='"Avenir Next", "SF Pro Text", "Segoe UI", sans-serif'>Avenir Next</option>
                <option value='"Segoe UI", "Helvetica Neue", Arial, sans-serif'>Segoe UI</option>
                <option value='"SF Pro Text", "Helvetica Neue", Arial, sans-serif'>SF Pro Text</option>
                <option value='"IBM Plex Sans", "Segoe UI", sans-serif'>IBM Plex Sans</option>
                <option value='"Figtree", "Avenir Next", sans-serif'>Figtree</option>
              </select>
            </div>

            <div class="settings-row">
              <label class="settings-label">Code Font</label>
              <select class="settings-select" id="s-code-font-family">
                <option value='"JetBrains Mono", "Cascadia Code", Consolas, monospace'>JetBrains Mono</option>
                <option value='"Cascadia Code", Consolas, monospace'>Cascadia Code</option>
                <option value='"Fira Code", Consolas, monospace'>Fira Code</option>
                <option value='Consolas, monospace'>Consolas</option>
                <option value='"SF Mono", monospace'>SF Mono</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">Editor</div>

            <div class="settings-row">
              <label class="settings-label">Line Numbers</label>
              <select class="settings-select" id="s-line-numbers">
                <option value="on">On</option>
                <option value="relative">Relative</option>
                <option value="off">Off</option>
              </select>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-minimap">Minimap</label>
              <label class="settings-toggle" aria-label="Minimap">
                <input type="checkbox" id="s-minimap" class="settings-toggle-input" />
                <span class="settings-toggle-track" aria-hidden="true"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-word-wrap">Word Wrap</label>
              <label class="settings-toggle" aria-label="Word Wrap">
                <input type="checkbox" id="s-word-wrap" class="settings-toggle-input" />
                <span class="settings-toggle-track" aria-hidden="true"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-format-on-save">Format On Save</label>
              <label class="settings-toggle" aria-label="Format On Save">
                <input type="checkbox" id="s-format-on-save" class="settings-toggle-input" />
                <span class="settings-toggle-track" aria-hidden="true"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    const colorThemeEl  = overlay.querySelector('#s-color-theme')  as HTMLSelectElement;
    const editorThemeEl = overlay.querySelector('#s-editor-theme') as HTMLSelectElement;
    const fontSizeEl    = overlay.querySelector('#s-font-size')    as HTMLInputElement;
    const fontSizeValEl = overlay.querySelector('#s-font-size-val') as HTMLElement;
    const uiFontFamilyEl   = overlay.querySelector('#s-ui-font-family')   as HTMLSelectElement;
    const codeFontFamilyEl = overlay.querySelector('#s-code-font-family') as HTMLSelectElement;
    const lineNumEl     = overlay.querySelector('#s-line-numbers') as HTMLSelectElement;
    const minimapEl     = overlay.querySelector('#s-minimap')      as HTMLInputElement;
    const wordWrapEl    = overlay.querySelector('#s-word-wrap')    as HTMLInputElement;
    const formatSaveEl  = overlay.querySelector('#s-format-on-save') as HTMLInputElement;

    const s = this.settings;
    colorThemeEl.value  = s.colorTheme;
    editorThemeEl.value = s.editorTheme;
    fontSizeEl.value    = String(s.fontSize);
    fontSizeValEl.textContent = `${s.fontSize}px`;
    uiFontFamilyEl.value   = s.uiFontFamily;
    codeFontFamilyEl.value = s.codeFontFamily;
    lineNumEl.value     = s.lineNumbers;
    minimapEl.checked   = s.minimap;
    wordWrapEl.checked  = s.wordWrap === 'on';
    formatSaveEl.checked = s.formatOnSave;

    const emit = () => { saveSettings(this.settings); this.onChange({ ...this.settings }); };

    colorThemeEl.addEventListener('change', () => {
      this.settings.colorTheme = colorThemeEl.value as ColorTheme;
      emit();
    });
    editorThemeEl.addEventListener('change', () => {
      this.settings.editorTheme = editorThemeEl.value as EditorTheme;
      emit();
    });
    fontSizeEl.addEventListener('input', () => {
      this.settings.fontSize = Number(fontSizeEl.value);
      fontSizeValEl.textContent = `${this.settings.fontSize}px`;
      emit();
    });
    uiFontFamilyEl.addEventListener('change', () => {
      this.settings.uiFontFamily = uiFontFamilyEl.value;
      emit();
    });
    codeFontFamilyEl.addEventListener('change', () => {
      this.settings.codeFontFamily = codeFontFamilyEl.value;
      emit();
    });
    lineNumEl.addEventListener('change', () => {
      this.settings.lineNumbers = lineNumEl.value as EditorSettings['lineNumbers'];
      emit();
    });
    minimapEl.addEventListener('change', () => {
      this.settings.minimap = minimapEl.checked;
      emit();
    });
    wordWrapEl.addEventListener('change', () => {
      this.settings.wordWrap = wordWrapEl.checked ? 'on' : 'off';
      emit();
    });
    formatSaveEl.addEventListener('change', () => {
      this.settings.formatOnSave = formatSaveEl.checked;
      emit();
    });

    overlay.querySelector('.settings-close')!.addEventListener('click', () => this.hide());
    overlay.addEventListener('click', e => { if (e.target === overlay) this.hide(); });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); this.hide(); return; }
      if (e.key === 'Tab') this.trapFocus(e);
    });

    return overlay;
  }

  private trapFocus(e: KeyboardEvent): void {
    const modal = this.overlay.querySelector('.settings-modal') as HTMLElement;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button, input, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.closest('.sr-only') || el.tagName !== 'INPUT');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  show(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.overlay.classList.remove('hidden');
    const modal = this.overlay.querySelector('.settings-modal') as HTMLElement;
    const first = modal.querySelector<HTMLElement>('button, input, select');
    first?.focus();
  }

  hide(): void {
    this.overlay.classList.add('hidden');
    this.previousFocus?.focus();
    this.previousFocus = null;
  }

  toggle(): void { if (this.overlay.classList.contains('hidden')) this.show(); else this.hide(); }
  current(): EditorSettings { return { ...this.settings }; }
}
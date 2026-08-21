
import { iconSvg } from './icons';

import { THEMES, isColorTheme, type ColorTheme } from './themes';

export type { ColorTheme };
export type EditorTheme = ColorTheme;

const THEME_OPTIONS = THEMES.map(t => `<option value="${t.id}">${t.label}</option>`).join('\n                ');

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
  autosave: boolean;
  uiScale: UiScale;
  gitAutofetch: boolean;
  gitAutofetchPeriod: number;
  tourDone: boolean;
}

export type UiScale = 'compact' | 'default' | 'large';
export const UI_SCALES = ['compact', 'default', 'large'] as const;

/** the periods the panel offers, in seconds */
export const GIT_AUTOFETCH_PERIODS = [60, 180, 300, 900] as const;

const DEFAULTS: EditorSettings = {
  colorTheme:  'dsmx',
  editorTheme: 'dsmx',
  fontSize:    14,
  codeFontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  uiFontFamily:   'Inter, "SF Pro Text", -apple-system, sans-serif',
  minimap:     false,
  lineNumbers: 'on',
  wordWrap:    'off',
  formatOnSave: false,
  // off by default: autosave writes the file with no dialog and no undo of the write
  autosave: false,
  uiScale: 'default',
  // off by default: a fetch reaches the network, and that is the user's call to make
  gitAutofetch: false,
  gitAutofetchPeriod: 180,
  tourDone: false,
};

const STORAGE_KEY = 'desmos-ide-settings';
const SETTINGS_VERSION = 3;

const VALID_LINE_NUMBERS = new Set(['on','off','relative']);
const VALID_WORD_WRAP = new Set(['on','off']);
const VALID_FONTS_CODE = new Set([
  '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  '"Cascadia Code", Consolas, monospace',
  '"IBM Plex Mono", Consolas, monospace',
  '"Fira Code", Consolas, monospace',
  'Consolas, monospace',
  '"SF Mono", monospace',
]);
const VALID_FONTS_UI = new Set([
  'Inter, "SF Pro Text", -apple-system, sans-serif',
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
    if (raw.colorTheme === 'dark') raw.colorTheme = 'catppuccin-mocha';
  }
  if (v < 3) {
    for (const key of ['colorTheme', 'editorTheme']) {
      if (raw[key] === 'desmos-dark') raw[key] = 'catppuccin-mocha';
    }
  }
  raw.__v = SETTINGS_VERSION;
  return raw;
}

function validate(raw: Record<string, unknown>): EditorSettings {
  const d = DEFAULTS;
  const colorTheme = isColorTheme(raw.colorTheme)
    ? raw.colorTheme : d.colorTheme;
  const editorTheme = isColorTheme(raw.editorTheme)
    ? raw.editorTheme : d.editorTheme;
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
  const autosave = typeof raw.autosave === 'boolean' ? raw.autosave : d.autosave;
  const uiScale = (UI_SCALES as readonly string[]).includes(raw.uiScale as string)
    ? (raw.uiScale as UiScale) : d.uiScale;
  const gitAutofetch = typeof raw.gitAutofetch === 'boolean' ? raw.gitAutofetch : d.gitAutofetch;
  const gitAutofetchPeriod = (GIT_AUTOFETCH_PERIODS as readonly number[]).includes(Number(raw.gitAutofetchPeriod))
    ? Number(raw.gitAutofetchPeriod) : d.gitAutofetchPeriod;
  const tourDone = typeof raw.tourDone === 'boolean' ? raw.tourDone : d.tourDone;
  return {
    colorTheme, editorTheme, fontSize, codeFontFamily, uiFontFamily,
    minimap, lineNumbers, wordWrap, formatOnSave, autosave, uiScale, gitAutofetch, gitAutofetchPeriod,
    tourDone,
  };
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
  private extraThemes: ExtraTheme[] = [];
  private settings: EditorSettings;
  private onChange: (s: EditorSettings) => void;
  private previousFocus: HTMLElement | null = null;
  private syncControls: () => void = () => {};
  private openJson?: (file: 'settings' | 'keybinds') => void;

  constructor(onChange: (s: EditorSettings) => void, openJson?: (file: 'settings' | 'keybinds') => void) {
    this.settings = loadSettings();
    this.onChange = onChange;
    this.openJson = openJson;
    this.overlay = this.build();
    document.body.appendChild(this.overlay);
  }

  setExtraThemes(themes: ExtraTheme[]): void {
    this.extraThemes = themes;
    const select = this.overlay.querySelector('#s-editor-theme') as HTMLSelectElement | null;
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

  private build(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'settings-dialog-title');

    overlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <span class="settings-title" id="settings-dialog-title">settings</span>
          <button class="settings-close" aria-label="Close settings">${iconSvg('x', { size: 14 })}</button>
        </div>
        <div class="settings-body">

          <div class="settings-group">
            <div class="settings-group-title">app theme</div>

            <div class="settings-row">
              <label class="settings-label">color theme</label>
              <select class="settings-select" id="s-color-theme">
                ${THEME_OPTIONS}
              </select>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-ui-scale">interface size</label>
              <select class="settings-select" id="s-ui-scale">
                <option value="compact">compact</option>
                <option value="default">default</option>
                <option value="large">large</option>
              </select>
            </div>
            <div class="settings-row settings-hint-row">
              <span class="settings-hint">Scales the panels, menus and status bar. The editor has its own font size.</span>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">editor theme</div>
            <div class="settings-row settings-hint-row">
              <span class="settings-hint">Applies to DSL editor and Enhanced view</span>
            </div>

            <div class="settings-row">
              <label class="settings-label">syntax theme</label>
              <select class="settings-select" id="s-editor-theme">
                ${THEME_OPTIONS}
              </select>
            </div>

            <div class="settings-row">
              <label class="settings-label">font size</label>
              <div class="settings-range-wrap">
                <input type="range" class="settings-range" id="s-font-size" min="12" max="20" step="1" />
                <span class="settings-range-val" id="s-font-size-val"></span>
              </div>
            </div>

            <div class="settings-row">
              <label class="settings-label">ui font</label>
              <select class="settings-select" id="s-ui-font-family">
                <option value='Inter, "SF Pro Text", -apple-system, sans-serif'>Inter</option>
                <option value='"Avenir Next", "SF Pro Text", "Segoe UI", sans-serif'>Avenir Next</option>
                <option value='"Segoe UI", "Helvetica Neue", Arial, sans-serif'>Segoe UI</option>
                <option value='"SF Pro Text", "Helvetica Neue", Arial, sans-serif'>SF Pro Text</option>
                <option value='"IBM Plex Sans", "Segoe UI", sans-serif'>IBM Plex Sans</option>
                <option value='"Figtree", "Avenir Next", sans-serif'>Figtree</option>
              </select>
            </div>

            <div class="settings-row">
              <label class="settings-label">code font</label>
              <select class="settings-select" id="s-code-font-family">
                <option value='"JetBrains Mono", "Cascadia Code", Consolas, monospace'>JetBrains Mono</option>
                <option value='"Cascadia Code", Consolas, monospace'>Cascadia Code</option>
                <option value='"IBM Plex Mono", Consolas, monospace'>IBM Plex Mono</option>
                <option value='"Fira Code", Consolas, monospace'>Fira Code</option>
                <option value='Consolas, monospace'>Consolas</option>
                <option value='"SF Mono", monospace'>SF Mono</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">editor</div>

            <div class="settings-row">
              <label class="settings-label">line numbers</label>
              <select class="settings-select" id="s-line-numbers">
                <option value="on">on</option>
                <option value="relative">relative</option>
                <option value="off">off</option>
              </select>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-minimap">minimap</label>
              <label class="settings-toggle" aria-label="Minimap">
                <input type="checkbox" id="s-minimap" class="settings-toggle-input" />
                <span class="settings-toggle-track" aria-hidden="true"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-word-wrap">word wrap</label>
              <label class="settings-toggle" aria-label="Word Wrap">
                <input type="checkbox" id="s-word-wrap" class="settings-toggle-input" />
                <span class="settings-toggle-track" aria-hidden="true"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-format-on-save">format on save</label>
              <label class="settings-toggle" aria-label="Format On Save">
                <input type="checkbox" id="s-format-on-save" class="settings-toggle-input" />
                <span class="settings-toggle-track" aria-hidden="true"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-autosave">autosave</label>
              <label class="settings-toggle" aria-label="Autosave">
                <input type="checkbox" id="s-autosave" class="settings-toggle-input" />
                <span class="settings-toggle-track" aria-hidden="true"></span>
              </label>
            </div>
            <div class="settings-row settings-hint-row">
              <span class="settings-hint">Writes the open file about a second after you stop typing. Untitled buffers are never given a file.</span>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">git</div>
            <div class="settings-row settings-hint-row">
              <span class="settings-hint">Background fetch keeps the ahead/behind count current. It uses the network.</span>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-git-autofetch">auto fetch</label>
              <label class="settings-toggle" aria-label="Auto Fetch">
                <input type="checkbox" id="s-git-autofetch" class="settings-toggle-input" />
                <span class="settings-toggle-track" aria-hidden="true"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="s-git-autofetch-period">fetch every</label>
              <select class="settings-select" id="s-git-autofetch-period">
                <option value="60">1 minute</option>
                <option value="180">3 minutes</option>
                <option value="300">5 minutes</option>
                <option value="900">15 minutes</option>
              </select>
            </div>
          </div>
        </div>
        <div class="settings-footer">
          <span class="settings-hint">Every setting is text in settings.json.</span>
          <span class="settings-footer-links">
            <button class="settings-link" id="s-open-settings-json" type="button">settings.json</button>
            <button class="settings-link" id="s-open-keybinds-json" type="button">keybinds.json</button>
          </span>
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
    const autosaveEl    = overlay.querySelector('#s-autosave')     as HTMLInputElement;
    const uiScaleEl     = overlay.querySelector('#s-ui-scale')     as HTMLSelectElement;
    const autofetchEl   = overlay.querySelector('#s-git-autofetch') as HTMLInputElement;
    const autofetchPeriodEl = overlay.querySelector('#s-git-autofetch-period') as HTMLSelectElement;

    this.syncControls = () => {
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
      autosaveEl.checked   = s.autosave;
      uiScaleEl.value      = s.uiScale;
      autofetchEl.checked  = s.gitAutofetch;
      autofetchPeriodEl.value = String(s.gitAutofetchPeriod);
      autofetchPeriodEl.disabled = !s.gitAutofetch;
    };
    this.syncControls();

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
    autosaveEl.addEventListener('change', () => {
      this.settings.autosave = autosaveEl.checked;
      emit();
    });
    uiScaleEl.addEventListener('change', () => {
      this.settings.uiScale = uiScaleEl.value as UiScale;
      emit();
    });
    autofetchEl.addEventListener('change', () => {
      this.settings.gitAutofetch = autofetchEl.checked;
      // the period says nothing while nothing fetches
      autofetchPeriodEl.disabled = !autofetchEl.checked;
      emit();
    });
    autofetchPeriodEl.addEventListener('change', () => {
      this.settings.gitAutofetchPeriod = Number(autofetchPeriodEl.value);
      emit();
    });

    overlay.querySelector('#s-open-settings-json')!.addEventListener('click', () => {
      this.hide();
      this.openJson?.('settings');
    });
    overlay.querySelector('#s-open-keybinds-json')!.addEventListener('click', () => {
      this.hide();
      this.openJson?.('keybinds');
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

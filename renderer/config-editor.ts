import * as monaco from './monaco';
import type { ConfigFile } from '../src/shared/rpc-schema';
import { iconEl } from './icons';

const JSON_LANGUAGE_ID = 'dsmx-json';
let languageReady = false;

function registerJsonLanguage(): void {
  if (languageReady) return;
  languageReady = true;
  monaco.languages.register({ id: JSON_LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(JSON_LANGUAGE_ID, {
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
    ],
  });
  monaco.languages.setMonarchTokensProvider(JSON_LANGUAGE_ID, {
    tokenizer: {
      root: [
        [/"(?:[^"\\]|\\.)*"\s*(?=:)/, 'type'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/\b(?:true|false|null)\b/, 'keyword'],
        [/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/, 'number'],
        [/[{}[\]]/, 'delimiter'],
        [/[,:]/, 'operator'],
      ],
    },
  });
}

export interface ConfigEditorOptions {
  read: (file: ConfigFile) => Promise<{ path: string; content: string } | null>;
  write: (file: ConfigFile, content: string) => Promise<boolean>;
  theme: () => string;
  fontSize: () => number;
  fontFamily: () => string;
}

const TITLES: Record<ConfigFile, string> = { settings: 'settings.json', keybinds: 'keybinds.json' };

export class ConfigEditor {
  private overlay: HTMLElement;
  private host: HTMLElement;
  private pathEl: HTMLElement;
  private noteEl: HTMLElement;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private file: ConfigFile = 'settings';
  private opened = false;
  private previousFocus: HTMLElement | null = null;

  constructor(private opts: ConfigEditorOptions) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'config-overlay hidden';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', 'configuration file');

    const modal = document.createElement('div');
    modal.className = 'config-modal';

    const header = document.createElement('div');
    header.className = 'config-header';

    this.pathEl = document.createElement('span');
    this.pathEl.className = 'config-path';

    const close = document.createElement('button');
    close.className = 'config-close';
    close.setAttribute('aria-label', 'Close');
    close.appendChild(iconEl('x', { size: 14 }));
    close.addEventListener('click', () => this.hide());

    header.append(this.pathEl, close);

    this.host = document.createElement('div');
    this.host.className = 'config-editor';

    const footer = document.createElement('div');
    footer.className = 'config-footer';

    this.noteEl = document.createElement('span');
    this.noteEl.className = 'config-note';

    const save = document.createElement('button');
    save.className = 'btn config-save';
    save.textContent = 'save';
    save.addEventListener('click', () => void this.save());

    footer.append(this.noteEl, save);

    modal.append(header, this.host, footer);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('mousedown', e => {
      if (e.target === this.overlay) this.hide();
    });
    this.overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); this.hide(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        void this.save();
      }
    });
  }

  isOpen(): boolean { return this.opened; }
  current(): ConfigFile { return this.file; }

  async open(file: ConfigFile): Promise<void> {
    this.file = file;
    const loaded = await this.opts.read(file);
    if (!loaded) return;

    registerJsonLanguage();
    if (!this.editor) {
      this.editor = monaco.editor.create(this.host, {
        value: loaded.content,
        language: JSON_LANGUAGE_ID,
        theme: this.opts.theme(),
        fontSize: this.opts.fontSize(),
        fontFamily: this.opts.fontFamily(),
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        lineHeight: 1.6,
        padding: { top: 10, bottom: 10 },
        renderLineHighlight: 'none',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
      });
      this.editor.onDidChangeModelContent(() => this.note(''));
    } else {
      monaco.editor.setTheme(this.opts.theme());
      this.editor.updateOptions({ fontSize: this.opts.fontSize(), fontFamily: this.opts.fontFamily() });
      this.editor.setValue(loaded.content);
    }

    this.pathEl.textContent = `${TITLES[file]} — ${loaded.path}`;
    this.note('');
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.opened = true;
    this.overlay.classList.remove('hidden');
    requestAnimationFrame(() => this.editor?.focus());
  }

  reload(file: ConfigFile, content: string): void {
    if (!this.opened || file !== this.file || !this.editor) return;
    if (this.editor.getValue() === content) return;
    this.editor.setValue(content);
    this.note('reloaded — the file changed on disk');
  }

  hide(): void {
    this.opened = false;
    this.overlay.classList.add('hidden');
    this.previousFocus?.focus();
    this.previousFocus = null;
  }

  private note(text: string, bad = false): void {
    this.noteEl.textContent = text;
    this.noteEl.classList.toggle('config-note--bad', bad);
  }

  private async save(): Promise<void> {
    const text = this.editor?.getValue() ?? '';
    try {
      JSON.parse(text);
    } catch (err) {
      this.note(err instanceof Error ? err.message : 'the file is not valid JSON', true);
      return;
    }
    const ok = await this.opts.write(this.file, text);
    this.note(ok ? 'saved' : 'could not write the file', !ok);
  }

  dispose(): void {
    this.editor?.dispose();
    this.editor = null;
    this.overlay.remove();
  }
}

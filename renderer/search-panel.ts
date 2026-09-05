import type { SearchHit } from '../src/shared/rpc-schema';
import { iconEl } from './icons';

type SearchOutcome =
  | { ok: true; hits: SearchHit[]; scanned: number }
  | { ok: false; errorCode: string; message: string };

export interface SearchPanelOptions {
  /** newest first */
  paths: () => string[];
  folder: () => string | null;
  search: (paths: string[], query: string, useRegex: boolean) => Promise<SearchOutcome>;
  searchFolder: (root: string, query: string, useRegex: boolean) => Promise<SearchOutcome>;
  pickFolder: () => Promise<string | null>;
  onOpen: (hit: SearchHit) => unknown;
}

export class SearchPanel {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private regexBtn: HTMLButtonElement;
  private summary: HTMLElement;
  private list: HTMLElement;
  private hits: SearchHit[] = [];
  private placeholder = '';
  private activeIdx = 0;
  private useRegex = false;
  private inFolder = false;
  private scopeBtn: HTMLButtonElement;
  private open = false;
  private previousFocus: HTMLElement | null = null;
  private chosenFolder: string | null = null;
  private pickBtn: HTMLButtonElement;
  private debounce: ReturnType<typeof setTimeout> | null = null;

  private runId = 0;

  constructor(private opts: SearchPanelOptions) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'cmd-overlay search-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    const modal = document.createElement('div');
    modal.className = 'cmd-modal search-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'search');

    const searchWrap = document.createElement('div');
    searchWrap.className = 'cmd-search-wrap';

    const icon = document.createElement('span');
    icon.className = 'cmd-search-icon';
    icon.appendChild(iconEl('search', { size: 13 }));

    this.input = document.createElement('input');
    this.input.className = 'cmd-input';
    this.input.type = 'text';
    this.input.placeholder = 'Search recent files…';
    this.input.setAttribute('aria-label', 'search recent files');
    this.input.spellcheck = false;

    this.regexBtn = document.createElement('button');
    this.regexBtn.className = 'search-regex-btn';
    this.regexBtn.type = 'button';
    this.regexBtn.textContent = '.*';
    this.regexBtn.title = 'Use a regular expression';
    this.regexBtn.setAttribute('aria-pressed', 'false');

    this.scopeBtn = document.createElement('button');
    this.scopeBtn.className = 'search-regex-btn';
    this.scopeBtn.type = 'button';
    this.scopeBtn.textContent = 'folder';
    this.scopeBtn.title = 'Search the folder of the open file';
    this.scopeBtn.setAttribute('aria-pressed', 'false');

    searchWrap.append(icon, this.input, this.scopeBtn, this.regexBtn);

    this.summary = document.createElement('div');
    this.summary.className = 'search-summary hidden';
    this.summary.setAttribute('role', 'status');

    this.pickBtn = document.createElement('button');
    this.pickBtn.className = 'search-pick-btn';
    this.pickBtn.type = 'button';
    this.pickBtn.textContent = 'Choose a folder…';
    this.pickBtn.hidden = true;

    this.list = document.createElement('ul');
    this.list.className = 'cmd-list';
    this.list.setAttribute('role', 'listbox');
    this.list.id = 'search-list';

    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-controls', 'search-list');
    this.input.setAttribute('aria-expanded', 'true');

    modal.append(searchWrap, this.summary, this.pickBtn, this.list);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    this.input.addEventListener('input', () => this.schedule());
    this.input.addEventListener('keydown', e => this.onKey(e));
    this.regexBtn.addEventListener('click', () => {
      this.useRegex = !this.useRegex;
      this.regexBtn.classList.toggle('active', this.useRegex);
      this.regexBtn.setAttribute('aria-pressed', String(this.useRegex));
      this.input.focus();
      this.schedule(0);
    });
    this.pickBtn.addEventListener('click', () => { void this.chooseFolder(); });
    this.scopeBtn.addEventListener('click', () => {
      this.inFolder = !this.inFolder;
      this.syncScope();
      this.input.focus();
      this.schedule(0);
    });
    this.overlay.addEventListener('mousedown', e => {
      if (e.target === this.overlay) this.close();
    });
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  /** the folder search would walk, whether the user picked it or the open file implies it */
  private activeFolder(): string | null {
    return this.chosenFolder ?? this.opts.folder();
  }

  private async chooseFolder(): Promise<void> {
    const picked = await this.opts.pickFolder();
    if (!picked) return;
    this.chosenFolder = picked;
    this.inFolder = true;
    this.scopeBtn.hidden = false;
    this.syncScope();
    this.input.focus();
    void this.run();
  }

  private syncScope(): void {
    // with no folder in reach, picking one is the only way forward
    this.pickBtn.hidden = this.activeFolder() !== null;
    this.scopeBtn.classList.toggle('active', this.inFolder);
    this.scopeBtn.setAttribute('aria-pressed', String(this.inFolder));
    this.input.placeholder = this.inFolder ? 'Search this folder…' : 'Search recent files…';
    this.input.setAttribute('aria-label', this.input.placeholder);
  }

  show(): void {
    this.open = true;
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.scopeBtn.hidden = this.activeFolder() === null;
    if (this.scopeBtn.hidden && this.inFolder) { this.inFolder = false; }
    this.syncScope();
    this.overlay.classList.add('cmd-overlay--visible');
    this.overlay.setAttribute('aria-hidden', 'false');
    // re-runs so the summary reflects the recent list as it is now, not as it was
    void this.run();
    requestAnimationFrame(() => { this.input.focus(); this.input.select(); });
  }

  close(): void {
    this.open = false;
    this.overlay.classList.remove('cmd-overlay--visible');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.clearDebounce();
    this.previousFocus?.focus();
    this.previousFocus = null;
  }

  dispose(): void {
    this.clearDebounce();
    this.overlay.remove();
  }

  private clearDebounce(): void {
    if (this.debounce === null) return;
    clearTimeout(this.debounce);
    this.debounce = null;
  }

  private schedule(delay = 180): void {
    this.clearDebounce();
    this.debounce = setTimeout(() => void this.run(), delay);
  }

  private async run(): Promise<void> {
    const query = this.input.value;
    const folder = this.inFolder ? this.activeFolder() : null;
    const paths = this.opts.paths();
    const id = ++this.runId;

    // the header counts results, so it stays away until there are results to count
    if (!query.trim()) {
      this.hits = [];
      this.placeholder = folder
        ? `type to search ${folder.split(/[\\/]/).pop() || folder}`
        : paths.length
          ? `type to search ${paths.map(p => p.split(/[\\/]/).pop()).slice(0, 2).join(' and ')}${paths.length > 2 ? ` and ${paths.length - 2} more` : ''}`
          : 'nothing to search yet — choose a folder, or open a file';
      this.say(null);
      this.render();
      return;
    }
    if (!folder && !paths.length) {
      this.hits = [];
      this.placeholder = 'nothing to search yet — choose a folder, or open a file';
      this.say(null);
      this.render();
      return;
    }

    this.placeholder = 'searching…';
    if (folder) this.say(null);
    const result = folder
      ? await this.opts.searchFolder(folder, query, this.useRegex)
      : await this.opts.search(paths, query, this.useRegex);
    if (id !== this.runId) return;

    if (!result.ok) {
      this.hits = [];
      this.placeholder = result.message;
      this.say(null);
      this.render();
      return;
    }

    this.hits = result.hits;
    this.activeIdx = 0;
    const files = `${result.scanned} ${result.scanned === 1 ? 'file' : 'files'}`;
    this.placeholder = `no results in ${files}`;
    this.say(result.hits.length
      ? `${result.hits.length} ${result.hits.length === 1 ? 'result' : 'results'} in ${files}`
      : null);
    this.render();
  }

  private say(text: string | null): void {
    this.summary.textContent = text ?? '';
    this.summary.classList.toggle('hidden', text === null);
  }

  private render(): void {
    this.list.innerHTML = '';
    if (!this.hits.length) {
      const empty = document.createElement('li');
      empty.className = 'search-placeholder';
      empty.textContent = this.placeholder;
      this.list.appendChild(empty);
      return;
    }

    this.hits.forEach((hit, i) => {
      const li = document.createElement('li');
      li.className = 'cmd-item' + (i === this.activeIdx ? ' cmd-item--active' : '');
      li.id = `search-item-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === this.activeIdx));
      if (i === this.activeIdx) this.input.setAttribute('aria-activedescendant', li.id);

      const left = document.createElement('div');
      left.className = 'cmd-item-left';

      const label = document.createElement('span');
      label.className = 'cmd-item-label search-hit-text';
      label.textContent = hit.text.trim() || '(blank line)';

      const desc = document.createElement('span');
      desc.className = 'cmd-item-desc';
      desc.textContent = `${hit.path.split(/[\\/]/).pop()} : ${hit.line}`;
      desc.title = hit.path;

      left.append(label, desc);
      li.appendChild(left);

      li.addEventListener('mouseenter', () => {
        this.activeIdx = i;
        this.render();
      });
      li.addEventListener('click', () => this.choose(hit));
      this.list.appendChild(li);
    });

    (this.list.children[this.activeIdx] as HTMLElement | undefined)
      ?.scrollIntoView({ block: 'nearest' });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIdx = Math.min(this.activeIdx + 1, this.hits.length - 1);
      this.render();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIdx = Math.max(this.activeIdx - 1, 0);
      this.render();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const hit = this.hits[this.activeIdx];
      if (hit) this.choose(hit);
    }
  }

  private choose(hit: SearchHit): void {
    this.close();
    void this.opts.onOpen(hit);
  }
}

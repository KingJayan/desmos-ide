import type { SearchHit } from '../src/shared/rpc-schema';

export interface SearchPanelOptions {
  /** the paths to search, newest first */
  paths: () => string[];
  search: (paths: string[], query: string, useRegex: boolean) => Promise<
    | { ok: true; hits: SearchHit[]; scanned: number }
    | { ok: false; errorCode: string; message: string }
  >;
  onOpen: (hit: SearchHit) => unknown;
}

export class SearchPanel {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private regexBtn: HTMLButtonElement;
  private summary: HTMLElement;
  private list: HTMLElement;
  private hits: SearchHit[] = [];
  private activeIdx = 0;
  private useRegex = false;
  private open = false;
  private debounce: ReturnType<typeof setTimeout> | null = null;

  private runId = 0;

  constructor(private opts: SearchPanelOptions) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'cmd-overlay search-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    const modal = document.createElement('div');
    modal.className = 'cmd-modal search-modal';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'cmd-search-wrap';

    const icon = document.createElement('span');
    icon.className = 'cmd-search-icon';
    icon.textContent = '⌕';

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

    searchWrap.append(icon, this.input, this.regexBtn);

    this.summary = document.createElement('div');
    this.summary.className = 'search-summary';

    this.list = document.createElement('ul');
    this.list.className = 'cmd-list';
    this.list.setAttribute('role', 'listbox');

    modal.append(searchWrap, this.summary, this.list);
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
    this.overlay.addEventListener('mousedown', e => {
      if (e.target === this.overlay) this.close();
    });
  }

  toggle(): void {
    this.open ? this.close() : this.show();
  }

  show(): void {
    this.open = true;
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
    const paths = this.opts.paths();
    const id = ++this.runId;

    if (!query.trim()) {
      this.hits = [];
      this.summary.textContent = paths.length
        ? `${paths.length} recent ${paths.length === 1 ? 'file' : 'files'}`
        : 'No recent files to search — open a file first';
      this.render();
      return;
    }
    if (!paths.length) {
      this.hits = [];
      this.summary.textContent = 'No recent files to search — open a file first';
      this.render();
      return;
    }

    const result = await this.opts.search(paths, query, this.useRegex);
    if (id !== this.runId) return;

    if (!result.ok) {
      this.hits = [];
      this.summary.textContent = result.message;
      this.render();
      return;
    }

    this.hits = result.hits;
    this.activeIdx = 0;
    this.summary.textContent = result.hits.length
      ? `${result.hits.length} ${result.hits.length === 1 ? 'result' : 'results'} in ${result.scanned} ${result.scanned === 1 ? 'file' : 'files'}`
      : `No results in ${result.scanned} ${result.scanned === 1 ? 'file' : 'files'}`;
    this.render();
  }

  private render(): void {
    this.list.innerHTML = '';
    if (!this.hits.length) return;

    this.hits.forEach((hit, i) => {
      const li = document.createElement('li');
      li.className = 'cmd-item' + (i === this.activeIdx ? ' cmd-item--active' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === this.activeIdx));

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

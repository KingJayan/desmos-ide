export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  keybinding?: string;
  action: () => void | Promise<void>;
}

export class CommandPalette {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private list: HTMLElement;
  private commands: PaletteCommand[] = [];
  private filtered: PaletteCommand[] = [];
  private activeIdx = 0;
  private open = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'cmd-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    const modal = document.createElement('div');
    modal.className = 'cmd-modal';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'cmd-search-wrap';

    const icon = document.createElement('span');
    icon.className = 'cmd-search-icon';
    icon.textContent = '›';

    this.input = document.createElement('input');
    this.input.className = 'cmd-input';
    this.input.type = 'text';
    this.input.placeholder = 'Type a command…';
    this.input.setAttribute('aria-label', 'command search');
    this.input.spellcheck = false;

    searchWrap.append(icon, this.input);

    this.list = document.createElement('ul');
    this.list.className = 'cmd-list';
    this.list.setAttribute('role', 'listbox');

    modal.append(searchWrap, this.list);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    this.input.addEventListener('input', () => this.filter());
    this.input.addEventListener('keydown', e => this.onKey(e));
    this.overlay.addEventListener('mousedown', e => {
      if (e.target === this.overlay) this.close();
    });
  }

  register(commands: PaletteCommand[]): void {
    this.commands = commands;
  }

  toggle(): void {
    this.open ? this.close() : this.show();
  }

  show(): void {
    this.open = true;
    this.overlay.classList.add('cmd-overlay--visible');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.input.value = '';
    this.filter();
    requestAnimationFrame(() => this.input.focus());
  }

  close(): void {
    this.open = false;
    this.overlay.classList.remove('cmd-overlay--visible');
    this.overlay.setAttribute('aria-hidden', 'true');
  }

  private filter(): void {
    const q = this.input.value.toLowerCase().trim();
    this.filtered = q
      ? this.commands.filter(c =>
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
        )
      : [...this.commands];
    this.activeIdx = 0;
    this.renderList();
  }

  private renderList(): void {
    this.list.innerHTML = '';
    if (this.filtered.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'cmd-empty';
      empty.textContent = 'No commands match';
      this.list.appendChild(empty);
      return;
    }
    this.filtered.forEach((cmd, i) => {
      const li = document.createElement('li');
      li.className = 'cmd-item' + (i === this.activeIdx ? ' cmd-item--active' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === this.activeIdx));

      const left = document.createElement('div');
      left.className = 'cmd-item-left';

      const label = document.createElement('span');
      label.className = 'cmd-item-label';
      label.textContent = cmd.label;

      left.appendChild(label);

      if (cmd.description) {
        const desc = document.createElement('span');
        desc.className = 'cmd-item-desc';
        desc.textContent = cmd.description;
        left.appendChild(desc);
      }

      li.appendChild(left);

      if (cmd.keybinding) {
        const kb = document.createElement('span');
        kb.className = 'cmd-item-kb';
        kb.textContent = cmd.keybinding;
        li.appendChild(kb);
      }

      li.addEventListener('mouseenter', () => {
        this.activeIdx = i;
        this.renderList();
      });
      li.addEventListener('click', () => this.run(cmd));
      this.list.appendChild(li);
    });

    const activeEl = this.list.children[this.activeIdx] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIdx = Math.min(this.activeIdx + 1, this.filtered.length - 1);
      this.renderList();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIdx = Math.max(this.activeIdx - 1, 0);
      this.renderList();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = this.filtered[this.activeIdx];
      if (cmd) this.run(cmd);
      return;
    }
  }

  private run(cmd: PaletteCommand): void {
    this.close();
    void cmd.action();
  }
}

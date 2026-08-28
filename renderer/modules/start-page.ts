import { iconEl } from '../icons';
import { recentLabel } from '../session';
import type { FolderEntry } from '../../src/shared/rpc-schema';

export interface StartPageOptions {
  root: HTMLElement;
  recents: () => string[];
  chord: (command: string) => string | null;
  newFile: () => void;
  openFile: () => void;
  openFolder: () => void;
  openPath: (path: string) => void;
  forget: (path: string) => void;
  runCommand: (id: string) => void;
}

interface Action {
  id: string;
  label: string;
  icon: 'file-plus' | 'folder-open' | 'box';
  run: () => void;
}

export class StartPage {
  private readonly actionsEl = document.createElement('div');
  private readonly recentList = document.createElement('ul');
  private readonly recentTitle = document.createElement('div');
  private readonly recentEmpty = document.createElement('div');
  private readonly folderEl = document.createElement('div');
  private readonly actions: Action[];
  private folder: { root: string; entries: FolderEntry[]; truncated: boolean } | null = null;

  constructor(private readonly opts: StartPageOptions) {
    this.actions = [
      { id: 'file.new', label: 'new file', icon: 'file-plus', run: opts.newFile },
      { id: 'file.open', label: 'open file…', icon: 'folder-open', run: opts.openFile },
      { id: 'workspace.open-folder', label: 'open folder…', icon: 'box', run: opts.openFolder },
    ];
    this.build();
  }

  private build(): void {
    const page = document.createElement('div');
    page.className = 'start-page';

    const mark = iconEl('dsmx-mark', { size: 44, strokeWidth: 1.6 });
    mark.classList.add('start-mark');

    const title = document.createElement('h1');
    title.className = 'start-title';
    title.textContent = 'dsmx';

    const lead = document.createElement('p');
    lead.className = 'start-lead';
    lead.textContent = 'A text language for Desmos graphs. Open a file to start, or write a new one.';

    this.actionsEl.className = 'start-actions';
    this.recentTitle.className = 'start-section-title';
    this.recentTitle.textContent = 'recent';
    this.recentList.className = 'start-recent-list';
    this.recentEmpty.className = 'start-empty';
    this.recentEmpty.textContent = 'nothing opened yet';
    this.folderEl.className = 'start-folder hidden';

    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'start-hint';
    hint.textContent = 'show all commands';
    hint.appendChild(this.chordTag('palette.toggle'));
    hint.addEventListener('click', () => this.opts.runCommand('palette.toggle'));

    page.append(mark, title, lead, this.actionsEl, this.folderEl, this.recentTitle, this.recentList, this.recentEmpty, hint);
    this.opts.root.appendChild(page);
    this.opts.root.setAttribute('aria-label', 'start');
    this.render();
  }

  private chordTag(command: string): HTMLElement {
    const tag = document.createElement('kbd');
    tag.className = 'start-chord';
    tag.textContent = this.opts.chord(command) ?? '';
    tag.hidden = !tag.textContent;
    return tag;
  }

  /** the folder the user picked, listed so a file is one more click away */
  showFolder(root: string, entries: FolderEntry[], truncated: boolean): void {
    this.folder = { root, entries, truncated };
    this.render();
  }

  clearFolder(): void {
    this.folder = null;
    this.render();
  }

  render(): void {
    this.actionsEl.replaceChildren();
    for (const action of this.actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'start-action';
      button.appendChild(iconEl(action.icon, { size: 16 }));
      const label = document.createElement('span');
      label.className = 'start-action-label';
      label.textContent = action.label;
      button.append(label, this.chordTag(action.id));
      button.addEventListener('click', action.run);
      this.actionsEl.appendChild(button);
    }

    this.folderEl.replaceChildren();
    this.folderEl.classList.toggle('hidden', this.folder === null);
    if (this.folder) {
      const title = document.createElement('div');
      title.className = 'start-section-title';
      title.textContent = this.folder.root.split(/[\\/]/).pop() || this.folder.root;
      title.title = this.folder.root;

      const list = document.createElement('ul');
      list.className = 'start-recent-list';
      for (const entry of this.folder.entries) {
        list.appendChild(this.fileRow(entry.name, entry.path, () => this.opts.openPath(entry.path)));
      }
      this.folderEl.append(title, list);

      if (this.folder.entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'start-empty';
        empty.textContent = 'this folder holds no .dsmx file';
        this.folderEl.appendChild(empty);
      } else if (this.folder.truncated) {
        const more = document.createElement('div');
        more.className = 'start-empty';
        more.textContent = 'more files than can be listed — use search to find the rest';
        this.folderEl.appendChild(more);
      }
    }

    const paths = this.opts.recents();
    this.recentList.replaceChildren();
    this.recentEmpty.classList.toggle('hidden', paths.length > 0);
    this.recentTitle.classList.toggle('hidden', paths.length === 0);
    for (const path of paths) {
      const { name, hint } = recentLabel(path, paths);
      this.recentList.appendChild(this.fileRow(name, hint || path, () => this.opts.openPath(path), path));
    }
  }

  private fileRow(name: string, hint: string, open: () => void, forget?: string): HTMLElement {
    const li = document.createElement('li');
    li.className = 'start-recent-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'start-recent-btn';
    button.title = hint;

    const label = document.createElement('span');
    label.className = 'start-recent-name';
    label.textContent = name;

    const where = document.createElement('span');
    where.className = 'start-recent-hint';
    where.textContent = hint;

    button.append(label, where);
    button.addEventListener('click', open);
    li.appendChild(button);

    if (forget) {
      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'start-recent-forget';
      drop.setAttribute('aria-label', `forget ${name}`);
      drop.title = 'remove from recent';
      drop.appendChild(iconEl('x', { size: 12 }));
      drop.addEventListener('click', e => {
        e.stopPropagation();
        this.opts.forget(forget);
        this.render();
      });
      li.appendChild(drop);
    }
    return li;
  }

  focus(): void {
    this.actionsEl.querySelector('button')?.focus();
  }
}

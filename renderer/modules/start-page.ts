import { iconEl } from '../icons';
import { recentLabel } from '../session';
import type { RecentFile } from '../session';
import type { FolderEntry } from '../../src/shared/rpc-schema';

export interface StartPageOptions {
  root: HTMLElement;
  recents: () => RecentFile[];
  chord: (command: string) => string | null;
  newFile: () => void;
  openFile: () => void;
  openFolder: () => void;
  listFolder: (path: string) => void;
  openPath: (path: string) => void;
  forget: (path: string) => void;
  openExample: () => void;
  runCommand: (id: string) => void;
}

function ago(at: number): string {
  const days = Math.floor((Date.now() - at) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Action {
  id: string;
  label: string;
  icon: 'file-plus' | 'folder-open' | 'box';
  run: () => void;
}

interface Card {
  icon: 'file-code' | 'info' | 'puzzle' | 'search';
  title: string;
  body: string;
  run: () => void;
}

export class StartPage {
  private readonly actionsEl = document.createElement('div');
  private readonly recentList = document.createElement('ul');
  private readonly recentTitle = document.createElement('div');
  private readonly recentEmpty = document.createElement('div');
  private readonly folderEl = document.createElement('div');
  private readonly foldersTitle = document.createElement('div');
  private readonly folderList = document.createElement('ul');
  private readonly actions: Action[];
  private readonly cards: Card[];
  private folder: { root: string; entries: FolderEntry[]; truncated: boolean } | null = null;

  constructor(private readonly opts: StartPageOptions) {
    this.foldersTitle.className = 'start-section-title';
    this.foldersTitle.textContent = 'recent folders';
    this.folderList.className = 'start-recent-list';
    this.actions = [
      { id: 'file.new', label: 'new file', icon: 'file-plus', run: opts.newFile },
      { id: 'file.open', label: 'open file…', icon: 'folder-open', run: opts.openFile },
      { id: 'workspace.open-folder', label: 'open folder…', icon: 'box', run: opts.openFolder },
    ];
    this.cards = [
      {
        icon: 'file-code',
        title: 'open the example',
        body: 'a short file that uses points, curves, sliders and styles.',
        run: opts.openExample,
      },
      {
        icon: 'info',
        title: 'take the tour',
        body: 'four steps across the editor, the graph and the palette.',
        run: () => opts.runCommand('help.tour'),
      },
      {
        icon: 'puzzle',
        title: 'browse plugins',
        body: 'macros, preludes and themes from the marketplace.',
        run: () => opts.runCommand('sidebar.plugins'),
      },
      {
        icon: 'search',
        title: 'show all commands',
        body: 'files, export, git and preferences all start in the palette.',
        run: () => opts.runCommand('palette.toggle'),
      },
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
    lead.textContent = 'a text language for Desmos graphs. open a file to start, or write a new one.';

    this.actionsEl.className = 'start-actions';
    this.recentTitle.className = 'start-section-title';
    this.recentTitle.textContent = 'recent files';
    this.recentList.className = 'start-recent-list';
    this.recentEmpty.className = 'start-empty';
    this.recentEmpty.textContent = 'nothing opened yet. open a file or a folder to begin.';
    this.folderEl.className = 'start-folder hidden';

    const head = document.createElement('div');
    head.className = 'start-head';
    head.append(mark, title, lead);

    const left = document.createElement('div');
    left.className = 'start-col start-col--main';
    left.append(
      this.actionsEl, this.folderEl,
      this.recentTitle, this.recentList, this.recentEmpty, this.foldersTitle, this.folderList,
    );

    const learnTitle = document.createElement('div');
    learnTitle.className = 'start-section-title';
    learnTitle.textContent = 'learn';

    const cardList = document.createElement('div');
    cardList.className = 'start-cards';
    for (const card of this.cards) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'start-card';
      button.appendChild(iconEl(card.icon, { size: 18 }));

      const body = document.createElement('span');
      body.className = 'start-card-text';
      const cardTitle = document.createElement('span');
      cardTitle.className = 'start-card-title';
      cardTitle.textContent = card.title;
      const cardBody = document.createElement('span');
      cardBody.className = 'start-card-body';
      cardBody.textContent = card.body;
      body.append(cardTitle, cardBody);

      button.appendChild(body);
      button.addEventListener('click', card.run);
      cardList.appendChild(button);
    }

    const right = document.createElement('div');
    right.className = 'start-col start-col--learn';
    right.append(learnTitle, cardList);

    const cols = document.createElement('div');
    cols.className = 'start-cols';
    cols.append(left, right);

    page.append(head, cols);
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

    const files = this.opts.recents();
    const paths = files.map(f => f.path);
    this.recentList.replaceChildren();
    this.recentEmpty.classList.toggle('hidden', paths.length > 0);
    this.recentTitle.classList.toggle('hidden', paths.length === 0);

    let group = '';
    for (const file of files) {
      const folder = file.path.split(/[\\/]/).slice(0, -1).join('/');
      if (folder !== group) {
        group = folder;
        const head = document.createElement('li');
        head.className = 'start-recent-group';
        head.textContent = folder.split(/[\\/]/).pop() || folder;
        head.title = folder;
        this.recentList.appendChild(head);
      }
      const { name, hint } = recentLabel(file.path, paths);
      this.recentList.appendChild(
        this.fileRow(name, hint || file.path, () => this.opts.openPath(file.path), file.path, file.openedAt),
      );
    }

    const folders: string[] = [];
    for (const file of files) {
      const folder = file.path.split(/[\\/]/).slice(0, -1).join('/');
      if (folder && !folders.includes(folder)) folders.push(folder);
    }
    this.folderList.replaceChildren();
    this.foldersTitle.classList.toggle('hidden', folders.length === 0);
    for (const folder of folders.slice(0, 6)) {
      this.folderList.appendChild(
        this.fileRow(folder.split(/[\\/]/).pop() || folder, folder, () => this.opts.listFolder(folder)),
      );
    }
  }

  private fileRow(name: string, hint: string, open: () => void, forget?: string, at?: number): HTMLElement {
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
    if (at) {
      const when = document.createElement('span');
      when.className = 'start-recent-when';
      when.textContent = ago(at);
      button.appendChild(when);
    }
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

import {
  loadRecent, pushRecent, removeRecent, saveRecent, saveSession,
  type Mode, type RecentFile,
} from './session';

export function folderOf(path: string | null): string | null {
  return path ? path.replace(/[\\/][^\\/]*$/, '') : null;
}

export function baseNameOf(path: string | null): string | null {
  return path ? path.split(/[\\/]/).pop() ?? null : null;
}

export interface WorkspaceOptions {
  onRecents?: (list: RecentFile[]) => void;
  recents?: RecentFile[];
  persist?: (state: { path: string | null; source: string; mode: Mode; line: number; col: number }) => void;
}

/** what file is open, what of it is on disk, and what was open before */
export class WorkspaceState {
  private currentPath: string | null = null;
  private saved: string | null = null;
  private currentMode: Mode = 'dsl';
  private watched: string | null = null;
  private recentFiles: RecentFile[];
  private readonly onRecents: (list: RecentFile[]) => void;
  private readonly write: (state: { path: string | null; source: string; mode: Mode; line: number; col: number }) => void;

  /** a restore writes the editor itself, so it must not look like the user typing */
  restoring = false;
  autosaving = false;

  constructor(opts: WorkspaceOptions = {}) {
    this.recentFiles = opts.recents ?? loadRecent();
    this.onRecents = opts.onRecents ?? (() => {});
    this.write = opts.persist ?? saveSession;
  }

  get path(): string | null { return this.currentPath; }
  get mode(): Mode { return this.currentMode; }
  get recents(): RecentFile[] { return this.recentFiles; }
  get savedSource(): string | null { return this.saved; }
  get watching(): string | null { return this.watched; }

  setMode(mode: Mode): void {
    this.currentMode = mode;
  }

  /** true when the containing folder changed, which is what a workspace is keyed on */
  setPath(path: string | null): boolean {
    const moved = folderOf(path) !== folderOf(this.currentPath);
    this.currentPath = path;
    if (path) this.remember(path);
    return moved;
  }

  name(): string {
    return baseNameOf(this.currentPath) ?? 'untitled.dsmx';
  }

  folder(): string | null {
    return folderOf(this.currentPath);
  }

  markSaved(content: string): void {
    this.saved = content;
  }

  forgetSaved(): void {
    this.saved = null;
  }

  isUnsaved(current: string): boolean {
    return this.saved === null || current !== this.saved;
  }

  remember(path: string): void {
    this.recentFiles = pushRecent(this.recentFiles, path);
    saveRecent(this.recentFiles);
    this.onRecents(this.recentFiles);
  }

  forget(path: string): void {
    this.recentFiles = removeRecent(this.recentFiles, path);
    saveRecent(this.recentFiles);
    this.onRecents(this.recentFiles);
  }

  /** the caller watches one file at a time, so this reports the one to drop */
  watch(path: string): string | null {
    const drop = this.watched && this.watched !== path ? this.watched : null;
    this.watched = path;
    return drop;
  }

  unwatch(): string | null {
    const drop = this.watched;
    this.watched = null;
    return drop;
  }

  persist(source: string, line: number, col: number): void {
    this.write({ path: this.currentPath, source, mode: this.currentMode, line, col });
  }
}

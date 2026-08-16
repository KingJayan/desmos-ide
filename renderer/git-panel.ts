import type {
  GitActionResult,
  GitBranchesResult,
  GitHistoryResult,
  GitRemotesResult,
  GitStatusResult,
} from '../src/shared/rpc-schema';

type GitFail = { ok: false; errorCode: string; message: string };

export interface GitPanelOptions {
  setStatus: (msg: string, kind: 'success' | 'error' | 'info') => void;
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

export interface GitAutofetchSettings {
  gitAutofetch: boolean;
  gitAutofetchPeriod: number;
}

const el = (id: string): HTMLElement => document.getElementById(id)!;

export class GitPanel {
  private branchPill = el('git-branch') as HTMLSpanElement;
  private modifiedPill = el('git-modified') as HTMLSpanElement;
  private summaryMsg = el('git-summary-msg');
  private refreshStatusBtn = el('git-refresh-status') as HTMLButtonElement;

  private branchTitle = el('git-branch-panel-title');
  private branchEmpty = el('git-branch-empty');
  private branchList = el('git-branch-list');
  private branchRefreshBtn = el('git-branch-refresh') as HTMLButtonElement;
  private branchCreateBtn = el('git-branch-create') as HTMLButtonElement;

  private historyEmpty = el('git-history-empty');
  private historyContent = el('git-history-content');
  private historyRefreshBtn = el('git-history-refresh') as HTMLButtonElement;

  private remoteTitle = el('git-remote-panel-title');
  private remoteEmpty = el('git-remote-empty');
  private remoteList = el('git-remote-list');
  private remoteRefreshBtn = el('git-remote-refresh') as HTMLButtonElement;
  private remoteAddBtn = el('git-remote-add') as HTMLButtonElement;

  private modifiedTitle = el('git-modified-panel-title');
  private modifiedEmpty = el('git-modified-empty');
  private modifiedList = el('git-modified-list');

  private timer: ReturnType<typeof setInterval> | null = null;
  private statusInFlight = false;
  private lastStatus: GitStatusResult = {
    ok: false,
    errorCode: 'INIT',
    message: 'Loading Git status...',
  };

  constructor(private opts: GitPanelOptions) {
    this.refreshStatusBtn.addEventListener('click', () => { void this.refreshAll(); });

    this.branchRefreshBtn.addEventListener('click', e => {
      e.stopPropagation();
      void this.refreshBranches();
    });
    this.historyRefreshBtn.addEventListener('click', e => {
      e.stopPropagation();
      void this.refreshHistory();
    });
    this.remoteRefreshBtn.addEventListener('click', e => {
      e.stopPropagation();
      void this.refreshRemotes();
    });

    this.branchCreateBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const raw = await this.opts.prompt('New branch name:');
      const name = raw?.trim();
      if (!name) return;
      this.report(await window.electronAPI?.gitCreateBranch(name));
      await Promise.all([this.refreshStatus(), this.refreshBranches(), this.refreshHistory()]);
    });

    this.remoteAddBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const nameRaw = await this.opts.prompt('Remote name:', 'origin');
      const name = nameRaw?.trim();
      if (!name) return;
      const urlRaw = await this.opts.prompt(`Remote URL for ${name}:`);
      const url = urlRaw?.trim();
      if (!url) return;
      this.report(await window.electronAPI?.gitRemoteAdd(name, url));
      await this.refreshRemotes();
    });
  }

  //refreshing

  private async refresh<T>(
    call: () => Promise<T | undefined> | undefined,
    render: (result: T | GitFail) => void,
  ): Promise<void> {
    try {
      const result = await call();
      if (result) render(result);
    } catch (err) {
      render({ ok: false, errorCode: 'UNKNOWN', message: String(err) });
    }
  }

  async refreshStatus(): Promise<void> {
    if (this.statusInFlight) return;
    this.statusInFlight = true;
    try {
      await this.refresh(() => window.electronAPI?.gitStatus(), r => this.renderStatus(r));
    } finally {
      this.statusInFlight = false;
    }
  }

  refreshBranches(): Promise<void> {
    return this.refresh(() => window.electronAPI?.gitBranches(), r => this.renderBranches(r));
  }

  refreshHistory(): Promise<void> {
    return this.refresh(() => window.electronAPI?.gitHistory(50), r => this.renderHistory(r));
  }

  refreshRemotes(): Promise<void> {
    return this.refresh(() => window.electronAPI?.gitRemotes(), r => this.renderRemotes(r));
  }

  refreshAll(): Promise<unknown> {
    return Promise.all([
      this.refreshStatus(), this.refreshBranches(), this.refreshHistory(), this.refreshRemotes(),
    ]);
  }

  refreshOnFocus(): Promise<unknown> {
    return Promise.all([this.refreshStatus(), this.refreshBranches(), this.refreshRemotes()]);
  }

  //bg fetch

  private async autofetchTick(): Promise<void> {
    if (document.visibilityState !== 'visible') return;
    const action = await window.electronAPI?.gitFetch();
    if (!action?.ok) return;
    await Promise.all([this.refreshStatus(), this.refreshBranches()]);
  }

  applyAutofetch(s: GitAutofetchSettings): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!s.gitAutofetch) return;
    this.timer = setInterval(() => { void this.autofetchTick(); }, s.gitAutofetchPeriod * 1000);
  }

  dispose(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  //rendering

  private report(result: GitActionResult | undefined): void {
    if (!result) return;
    this.opts.setStatus(result.message, result.ok ? 'success' : 'error');
  }

  private setPillState(kind: 'clean' | 'dirty' | 'unknown'): void {
    for (const pill of [this.branchPill, this.modifiedPill]) {
      pill.classList.remove('git-pill--clean', 'git-pill--dirty', 'git-pill--unknown');
      pill.classList.add(`git-pill--${kind}`);
    }
  }

  private renderStatus(status: GitStatusResult): void {
    this.lastStatus = status;
    this.renderModified(status);

    if (!status.ok) {
      this.branchPill.textContent = 'branch: --';
      this.modifiedPill.textContent = 'git unavailable';
      this.summaryMsg.textContent = status.message;
      this.setPillState('unknown');
      return;
    }

    this.branchPill.textContent = `branch: ${status.branch}`;
    this.modifiedPill.textContent = status.modifiedCount === 1 ? '1 modified' : `${status.modifiedCount} modified`;
    this.summaryMsg.textContent = status.modifiedCount
      ? status.modifiedFiles.slice(0, 12).join(' | ')
      : 'Working tree clean';
    this.setPillState(status.modifiedCount > 0 ? 'dirty' : 'clean');
  }

  private renderModified(status: GitStatusResult): void {
    this.modifiedList.innerHTML = '';

    if (!status.ok) {
      this.modifiedTitle.textContent = 'Git status';
      this.modifiedEmpty.textContent = status.message;
      this.modifiedEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.modifiedTitle.textContent = status.modifiedCount === 1
      ? '1 modified file'
      : `${status.modifiedCount} modified files`;
    if (status.modifiedCount === 0) {
      this.modifiedEmpty.textContent = 'Working tree clean';
      this.modifiedEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.modifiedEmpty.classList.remove('git-modified-empty--show');
    for (const file of status.modifiedFiles) {
      const li = document.createElement('li');
      li.textContent = file;
      li.title = file;
      this.modifiedList.appendChild(li);
    }
  }

  private renderBranches(result: GitBranchesResult): void {
    this.branchList.innerHTML = '';

    if (!result.ok) {
      this.branchTitle.textContent = 'Branches';
      this.branchEmpty.textContent = result.message;
      this.branchEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.branchTitle.textContent = `Branches (${result.branches.length})`;
    if (result.branches.length === 0) {
      this.branchEmpty.textContent = 'No branches found';
      this.branchEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.branchEmpty.classList.remove('git-modified-empty--show');
    for (const branch of result.branches) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'git-branch-row';

      const meta = document.createElement('div');
      meta.className = 'git-branch-meta';
      const name = document.createElement('div');
      name.className = 'git-branch-name';
      name.textContent = branch.current ? `* ${branch.name}` : branch.name;
      name.title = branch.name;
      meta.appendChild(name);

      if (branch.upstream) {
        const upstream = document.createElement('div');
        upstream.className = 'git-branch-upstream';
        upstream.textContent = branch.tracking
          ? `${branch.upstream} (${branch.tracking})`
          : branch.upstream;
        meta.appendChild(upstream);
      }

      row.appendChild(meta);

      if (!branch.current) {
        const actions = document.createElement('div');
        actions.className = 'git-inline-actions';
        actions.appendChild(this.actionBtn('Checkout', async () => {
          this.report(await window.electronAPI?.gitCheckoutBranch(branch.name));
          await Promise.all([this.refreshStatus(), this.refreshBranches(), this.refreshHistory()]);
        }));
        row.appendChild(actions);
      }

      li.appendChild(row);
      this.branchList.appendChild(li);
    }
  }

  private renderHistory(result: GitHistoryResult): void {
    const lines = result.ok ? result.lines : [];
    const empty = !result.ok ? result.message : lines.length === 0 ? 'No history found' : null;
    if (empty !== null) {
      this.historyEmpty.textContent = empty;
      this.historyEmpty.classList.add('git-modified-empty--show');
      this.historyContent.classList.remove('git-history-content--show');
      this.historyContent.textContent = '';
      return;
    }

    this.historyEmpty.classList.remove('git-modified-empty--show');
    this.historyContent.classList.add('git-history-content--show');
    this.historyContent.textContent = lines.join('\n');
  }

  private renderRemotes(result: GitRemotesResult): void {
    this.remoteList.innerHTML = '';

    if (!result.ok) {
      this.remoteTitle.textContent = 'Remotes';
      this.remoteEmpty.textContent = result.message;
      this.remoteEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.remoteTitle.textContent = `Remotes (${result.remotes.length})`;

    if (result.remotes.length === 0) {
      this.remoteEmpty.textContent = 'No remotes configured';
      this.remoteEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.remoteEmpty.classList.remove('git-modified-empty--show');
    for (const remote of result.remotes) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'git-remote-row';

      const meta = document.createElement('div');
      meta.className = 'git-remote-meta';
      const name = document.createElement('div');
      name.className = 'git-branch-name';
      name.textContent = remote.name;
      const fetchUrl = document.createElement('div');
      fetchUrl.className = 'git-remote-url';
      fetchUrl.textContent = `fetch: ${remote.fetchUrl || '--'}`;
      const pushUrl = document.createElement('div');
      pushUrl.className = 'git-remote-url';
      pushUrl.textContent = `push: ${remote.pushUrl || '--'}`;
      meta.append(name, fetchUrl, pushUrl);
      row.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'git-inline-actions';
      actions.append(
        this.actionBtn('Fetch', async () => {
          this.report(await window.electronAPI?.gitFetch(remote.name));
          await Promise.all([this.refreshStatus(), this.refreshHistory()]);
        }),
        this.actionBtn('Pull', async () => {
          this.report(await window.electronAPI?.gitPull(remote.name, this.currentBranch()));
          await Promise.all([this.refreshStatus(), this.refreshHistory()]);
        }),
        this.actionBtn('Push', async () => {
          this.report(await window.electronAPI?.gitPush(remote.name, this.currentBranch()));
          await Promise.all([this.refreshStatus(), this.refreshHistory()]);
        }),
        this.actionBtn('Remove', async () => {
          if (!(await this.opts.confirm(`Remove remote ${remote.name}?`))) return;
          this.report(await window.electronAPI?.gitRemoteRemove(remote.name));
          await this.refreshRemotes();
        }),
      );

      row.appendChild(actions);
      li.appendChild(row);
      this.remoteList.appendChild(li);
    }
  }

  private currentBranch(): string | undefined {
    return this.lastStatus.ok ? this.lastStatus.branch : undefined;
  }

  private actionBtn(label: string, run: () => Promise<void>): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'git-panel-btn';
    btn.textContent = label;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      void run();
    });
    return btn;
  }
}

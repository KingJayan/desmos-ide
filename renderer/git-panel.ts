import { iconEl } from './icons';
import { relativeTime } from '../src/shared/relative-time';
import type { IconName } from './icons';
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
  onBranch?: (branch: string | null) => void;
}

export interface GitAutofetchSettings {
  gitAutofetch: boolean;
  gitAutofetchPeriod: number;
}

const el = (id: string): HTMLElement => document.getElementById(id)!;

const MIN_GAP_MS = 3000;
const CALL_TIMEOUT_MS = 15000;

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

  private commitMessage = el('git-commit-message') as HTMLTextAreaElement;
  private commitBtn = el('git-commit-btn') as HTMLButtonElement;

  private container = el('git-sidebar-container');

  private timer: ReturnType<typeof setInterval> | null = null;
  private lastRefresh = 0;
  private filled = false;
  private statusInFlight = false;
  private lastStatus: GitStatusResult = {
    ok: false,
    errorCode: 'INIT',
    message: 'Loading Git status...',
  };

  constructor(private opts: GitPanelOptions) {
    this.wireSectionToggles();
    this.refreshStatusBtn.addEventListener('click', () => { void this.refreshAll(); });

    this.commitMessage.addEventListener('input', () => this.syncCommitBtn());
    this.commitMessage.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void this.commit(); }
    });
    this.commitBtn.addEventListener('click', () => { void this.commit(); });

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

  private wireSectionToggles(): void {
    for (const header of this.container.querySelectorAll<HTMLElement>('.git-section-header')) {
      const key = header.dataset.section;
      const section = header.parentElement;
      if (!key || !section) continue;
      const apply = (collapsed: boolean): void => {
        section.classList.toggle('git-section--collapsed', collapsed);
        header.setAttribute('aria-expanded', String(!collapsed));
        localStorage.setItem(`git-section-${key}`, collapsed ? 'collapsed' : 'open');
      };
      apply(localStorage.getItem(`git-section-${key}`) === 'collapsed');
      header.addEventListener('click', () => {
        apply(!section.classList.contains('git-section--collapsed'));
      });
      header.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // space would otherwise scroll the panel away from the header
        e.preventDefault();
        apply(!section.classList.contains('git-section--collapsed'));
      });
    }
  }

  //refreshing

  private async refresh<T>(
    call: () => Promise<T | undefined> | undefined,
    render: (result: T | GitFail) => void,
  ): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const pending = call();
      const result = pending && await Promise.race([
        pending,
        new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), CALL_TIMEOUT_MS); }),
      ]);
      if (result) render(result);
      else render({ ok: false, errorCode: 'UNAVAILABLE', message: 'Git did not answer. Use refresh to try again.' });
    } catch {
      render({ ok: false, errorCode: 'UNKNOWN', message: 'Could not read the repository. Use refresh to try again.' });
    } finally {
      if (timer) clearTimeout(timer);
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
    this.lastRefresh = Date.now();
    this.filled = true;
    return Promise.all([
      this.refreshStatus(), this.refreshBranches(), this.refreshHistory(), this.refreshRemotes(),
    ]);
  }

  refreshIfStale(): Promise<unknown> {
    const onScreen = !this.container.classList.contains('hidden');
    // the sections still say "loading", so a first look must fill them
    if (onScreen && !this.filled) return this.refreshAll();
    if (Date.now() - this.lastRefresh < MIN_GAP_MS) return Promise.resolve();
    if (!onScreen) {
      this.lastRefresh = Date.now();
      return this.refreshStatus();
    }
    return this.refreshAll();
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
    this.syncCommitBtn();

    this.opts.onBranch?.(status.ok ? status.branch : null);

    if (!status.ok) {
      this.branchPill.textContent = 'branch: --';
      this.modifiedPill.textContent = 'git unavailable';
      this.summaryMsg.textContent = status.message;
      this.summaryMsg.classList.remove('hidden');
      this.setPillState('unknown');
      return;
    }

    this.branchPill.textContent = `branch: ${status.branch}`;
    this.modifiedPill.textContent = status.modifiedCount === 1 ? '1 modified' : `${status.modifiedCount} modified`;
    this.summaryMsg.textContent = 'working tree clean';
    this.summaryMsg.classList.toggle('hidden', status.modifiedCount > 0);
    this.setPillState(status.modifiedCount > 0 ? 'dirty' : 'clean');
  }

  private renderModified(status: GitStatusResult): void {
    this.modifiedList.innerHTML = '';

    if (!status.ok) {
      this.modifiedTitle.textContent = 'git status';
      this.modifiedEmpty.textContent = status.message;
      this.modifiedEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.modifiedTitle.textContent = status.modifiedCount === 1
      ? '1 modified file'
      : `${status.modifiedCount} modified files`;
    if (status.modifiedCount === 0) {
      this.modifiedEmpty.textContent = 'working tree clean';
      this.modifiedEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.modifiedEmpty.classList.remove('git-modified-empty--show');
    const staged = new Set(status.staged);
    for (const file of status.modifiedFiles) {
      const on = staged.has(file);
      const li = document.createElement('li');
      li.className = 'git-change-row';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'git-change-stage';
      toggle.title = on ? `Unstage ${file}` : `Stage ${file}`;
      toggle.setAttribute('aria-label', toggle.title);
      toggle.setAttribute('aria-pressed', String(on));
      toggle.textContent = on ? '−' : '+';
      toggle.addEventListener('click', () => void this.setStaged(file, !on));

      const name = document.createElement('span');
      name.className = on ? 'git-change-name git-change-name--staged' : 'git-change-name';
      name.textContent = file;
      name.title = file;

      li.append(toggle, name);
      this.modifiedList.appendChild(li);
    }
  }

  private syncCommitBtn(): void {
    const staged = this.lastStatus.ok ? this.lastStatus.staged.length : 0;
    this.commitBtn.disabled = !this.commitMessage.value.trim() || staged === 0;
    this.commitBtn.title = staged === 0 ? 'stage a file first' : `commit ${staged} staged file(s)`;
  }

  private async setStaged(file: string, on: boolean): Promise<void> {
    const api = window.electronAPI;
    this.report(await (on ? api?.gitStage([file]) : api?.gitUnstage([file])));
    await this.refreshStatus();
  }

  private async commit(): Promise<void> {
    const message = this.commitMessage.value.trim();
    if (!message) return;
    this.commitBtn.disabled = true;
    const result = await window.electronAPI?.gitCommit(message);
    this.report(result);
    if (result?.ok) this.commitMessage.value = '';
    await Promise.all([this.refreshStatus(), this.refreshHistory()]);
  }

  private renderBranches(result: GitBranchesResult): void {
    this.branchList.innerHTML = '';

    if (!result.ok) {
      this.branchTitle.textContent = 'branches';
      this.branchEmpty.textContent = result.message;
      this.branchEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.branchTitle.textContent = `branches (${result.branches.length})`;
    if (result.branches.length === 0) {
      this.branchEmpty.textContent = 'no branches found';
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
        actions.appendChild(this.actionBtn('checkout', async () => {
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
    const commits = result.ok ? result.commits : [];
    const empty = !result.ok ? result.message : commits.length === 0 ? 'no history found' : null;
    this.historyContent.replaceChildren();
    if (empty !== null) {
      this.historyEmpty.textContent = empty;
      this.historyEmpty.classList.add('git-modified-empty--show');
      this.historyContent.classList.remove('git-history-content--show');
      return;
    }

    this.historyEmpty.classList.remove('git-modified-empty--show');
    this.historyContent.classList.add('git-history-content--show');
    for (const commit of commits) {
      const row = document.createElement('li');
      row.className = 'git-commit-row';
      row.title = `${commit.hash}  ${commit.subject}`;

      const subject = document.createElement('div');
      subject.className = 'git-commit-subject';
      subject.textContent = commit.subject;

      const meta = document.createElement('div');
      meta.className = 'git-commit-meta';
      const hash = document.createElement('span');
      hash.className = 'git-commit-hash';
      hash.textContent = commit.hash;
      const who = document.createElement('span');
      who.className = 'git-commit-who';
      who.textContent = `${commit.author} · ${relativeTime(Date.parse(commit.date))}`;
      meta.append(hash, who);

      row.append(subject, meta);
      this.historyContent.appendChild(row);
    }
  }

  private renderRemotes(result: GitRemotesResult): void {
    this.remoteList.innerHTML = '';

    if (!result.ok) {
      this.remoteTitle.textContent = 'remotes';
      this.remoteEmpty.textContent = result.message;
      this.remoteEmpty.classList.add('git-modified-empty--show');
      return;
    }

    this.remoteTitle.textContent = `remotes (${result.remotes.length})`;

    if (result.remotes.length === 0) {
      this.remoteEmpty.textContent = 'no remotes configured';
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
        this.actionBtn('fetch', async () => {
          this.report(await window.electronAPI?.gitFetch(remote.name));
          await Promise.all([this.refreshStatus(), this.refreshHistory()]);
        }, 'refresh-cw'),
        this.actionBtn('pull', async () => {
          this.report(await window.electronAPI?.gitPull(remote.name, this.currentBranch()));
          await Promise.all([this.refreshStatus(), this.refreshHistory()]);
        }, 'arrow-down'),
        this.actionBtn('push', async () => {
          this.report(await window.electronAPI?.gitPush(remote.name, this.currentBranch()));
          await Promise.all([this.refreshStatus(), this.refreshHistory()]);
        }, 'arrow-up'),
        this.actionBtn('remove', async () => {
          if (!(await this.opts.confirm(`remove the remote ${remote.name}?`))) return;
          this.report(await window.electronAPI?.gitRemoteRemove(remote.name));
          await this.refreshRemotes();
        }, 'trash-2'),
      );

      row.appendChild(actions);
      li.appendChild(row);
      this.remoteList.appendChild(li);
    }
  }

  private currentBranch(): string | undefined {
    return this.lastStatus.ok ? this.lastStatus.branch : undefined;
  }

  private actionBtn(label: string, run: () => Promise<void>, icon?: IconName): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = icon ? 'git-panel-btn git-panel-btn--icon' : 'git-panel-btn';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    if (icon) btn.appendChild(iconEl(icon, { size: 13 }));
    else btn.textContent = label;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      void run();
    });
    return btn;
  }
}

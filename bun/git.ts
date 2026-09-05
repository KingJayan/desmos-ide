import { execFile } from 'child_process';
import { promisify } from 'util';
import { dirname, join } from 'path';
import type {
  GitActionResult,
  GitBranchInfo,
  GitBranchesResult,
  GitHistoryResult,
  GitRemoteInfo,
  GitRemotesResult,
  GitStatusResult,
} from '../src/shared/rpc-schema';

const execFileAsync = promisify(execFile);

type GitErr = { ok: false; errorCode: string; message: string };

function noRepo(): GitErr {
  return {
    ok: false,
    errorCode: 'NO_REPO',
    message: contextDir
      ? 'The open file is not inside a Git repository.'
      : 'No Git repository found from app working paths.',
  };
}

let gitRepoPathCache: string | null = null;
let contextDir: string | null = null;

// the panel follows the open file, not the app binary
export function setGitContext(filePath: string | null): void {
  const dir = filePath ? dirname(filePath) : null;
  if (dir === contextDir) return;
  contextDir = dir;
  gitRepoPathCache = null;
}

async function resolveGitRepoPath(): Promise<string | null> {
  if (gitRepoPathCache) return gitRepoPathCache;
  // in a packaged bundle cwd is Resources/, so walk up toward the project root too
  const appPath = dirname(process.execPath);
  const candidates = contextDir ? [contextDir] : Array.from(new Set([
    process.cwd(),
    appPath,
    join(appPath, '..'),
    join(appPath, '..', '..'),
  ]));
  for (const candidate of candidates) {
    try {
      const { stdout } = await execFileAsync('git', ['-C', candidate, 'rev-parse', '--show-toplevel'], {
        timeout: 1800,
        maxBuffer: 512 * 1024,
      });
      const root = stdout.trim();
      if (root) {
        gitRepoPathCache = root;
        return root;
      }
    } catch {}
  }
  return null;
}

function gitErrorResult(err: unknown): GitErr {
  const text = String(err);
  if (text.includes('not a git repository')) {
    gitRepoPathCache = null;
    return { ok: false, errorCode: 'NO_REPO', message: 'Current project is not a Git repository.' };
  }
  return { ok: false, errorCode: 'GIT_ERROR', message: text };
}

async function runGit(repoPath: string, args: string[], timeout = 2400): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repoPath, ...args], {
    timeout,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

/**
 * execFile takes an argv array, so no shell reads these names. git itself still
 * reads a leading dash as one of its own options, and a branch or a remote is never
 * allowed to start with one, so the name is refused before git sees it
 */
function badName(label: string, value: string | undefined): GitErr | null {
  const v = (value ?? '').trim();
  if (!v) return { ok: false, errorCode: 'BAD_PAYLOAD', message: `${label} is required.` };
  if (v.startsWith('-')) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: `${label} cannot start with '-'.` };
  }
  return null;
}

/** the same check for a value that is allowed to be absent */
function badOptional(label: string, value: string | undefined): GitErr | null {
  return value === undefined ? null : badName(label, value);
}

// every command shares the same resolve-repo-then-run-or-map-error shape
async function inRepo<T>(fn: (repoPath: string) => Promise<T>): Promise<T | GitErr> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) return noRepo();
  try {
    return await fn(repoPath);
  } catch (err) {
    return gitErrorResult(err);
  }
}

export async function getGitStatus(): Promise<GitStatusResult> {
  return inRepo(async repoPath => {
    const [branchRaw, statusRaw] = await Promise.all([
      runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'], 1800),
      runGit(repoPath, ['status', '--porcelain', '--untracked-files=all'], 1800),
    ]);
    const lines = statusRaw.split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean);
    const pathOf = (line: string): string => {
      const rawPath = line.slice(3).trim();
      const renameParts = rawPath.split(' -> ');
      return (renameParts[renameParts.length - 1] || rawPath).replace(/^"|"$/g, '');
    };
    const modifiedFiles = lines.map(pathOf);
    // porcelain reports the index in column one and the working tree in column two,
    // so a file can be in both lists at once
    const staged = lines.filter(l => l[0] && l[0] !== ' ' && l[0] !== '?').map(pathOf);
    const unstaged = lines.filter(l => l[1] && l[1] !== ' ').map(pathOf);
    return {
      ok: true as const,
      branch: branchRaw.trim() || 'detached',
      modifiedCount: modifiedFiles.length,
      modifiedFiles,
      staged,
      unstaged,
    };
  });
}

export async function getGitBranches(): Promise<GitBranchesResult> {
  return inRepo(async repoPath => {
    const [branchRaw, listRaw] = await Promise.all([
      runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
      runGit(repoPath, ['branch', '--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:trackshort)']),
    ]);
    const branches = listRaw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line): GitBranchInfo => {
        const [name = '', head = '', upstream = '', tracking = ''] = line.split('|');
        return {
          name,
          current: head.trim() === '*',
          upstream: upstream.trim() || null,
          tracking: tracking.trim() || null,
        };
      });
    return { ok: true as const, currentBranch: branchRaw.trim() || 'detached', branches };
  });
}

export async function getGitHistory(limit: number): Promise<GitHistoryResult> {
  const maxCount = Number.isFinite(limit) ? Math.max(10, Math.min(120, Math.floor(limit))) : 40;
  return inRepo(async repoPath => {
    const raw = await runGit(
      repoPath,
      ['log', '--date=iso-strict', `--max-count=${maxCount}`, '--pretty=format:%h%x1f%s%x1f%an%x1f%ad%x1f%D'],
      3200,
    );
    const commits = raw.split(/\r?\n/).filter(Boolean).map(line => {
      const [hash = '', subject = '', author = '', date = '', refs = ''] = line.split('\u001f');
      return { hash, subject, author, date, refs };
    });
    return { ok: true as const, commits };
  });
}

export async function getGitRemotes(): Promise<GitRemotesResult> {
  return inRepo(async repoPath => {
    const raw = await runGit(repoPath, ['remote', '-v']);
    const map = new Map<string, GitRemoteInfo>();
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (!m) continue;
      const [, name, url, mode] = m;
      const existing = map.get(name) ?? { name, fetchUrl: '', pushUrl: '' };
      if (mode === 'fetch') existing.fetchUrl = url;
      if (mode === 'push') existing.pushUrl = url;
      map.set(name, existing);
    }
    return { ok: true as const, remotes: Array.from(map.values()) };
  });
}

export async function gitCheckoutBranch(name: string): Promise<GitActionResult> {
  const bad = badName('Branch name', name);
  if (bad) return bad;
  return inRepo(async repoPath => {
    await runGit(repoPath, ['checkout', name.trim()], 4200);
    return { ok: true as const, message: `Switched to ${name.trim()}` };
  });
}

export async function gitCreateBranch(name: string): Promise<GitActionResult> {
  const bad = badName('Branch name', name);
  if (bad) return bad;
  return inRepo(async repoPath => {
    await runGit(repoPath, ['checkout', '-b', name.trim()], 4200);
    return { ok: true as const, message: `Created and switched to ${name.trim()}` };
  });
}

function badPaths(paths: string[]): GitErr | null {
  if (paths.length === 0) return { ok: false, errorCode: 'BAD_INPUT', message: 'No file was named.' };
  if (paths.some(p => typeof p !== 'string' || !p.trim() || p.startsWith('-'))) {
    return { ok: false, errorCode: 'BAD_INPUT', message: 'That file name cannot be used.' };
  }
  return null;
}

export async function gitStage(paths: string[]): Promise<GitActionResult> {
  const bad = badPaths(paths);
  if (bad) return bad;
  return inRepo(async repoPath => {
    await runGit(repoPath, ['add', '--', ...paths], 4200);
    return { ok: true as const, message: `Staged ${paths.length} file${paths.length === 1 ? '' : 's'}` };
  });
}

export async function gitUnstage(paths: string[]): Promise<GitActionResult> {
  const bad = badPaths(paths);
  if (bad) return bad;
  return inRepo(async repoPath => {
    await runGit(repoPath, ['restore', '--staged', '--', ...paths], 4200);
    return { ok: true as const, message: `Unstaged ${paths.length} file${paths.length === 1 ? '' : 's'}` };
  });
}

export async function gitCommit(message: string): Promise<GitActionResult> {
  const text = message.trim();
  if (!text) return { ok: false, errorCode: 'BAD_INPUT', message: 'A commit needs a message.' };
  return inRepo(async repoPath => {
    const staged = await runGit(repoPath, ['diff', '--cached', '--name-only'], 2400);
    if (!staged.trim()) {
      return { ok: false as const, errorCode: 'BAD_INPUT', message: 'Nothing is staged to commit.' };
    }
    const out = await runGit(repoPath, ['commit', '-m', text], 6000);
    return { ok: true as const, message: out.split(/\r?\n/)[0]?.trim() || 'Committed' };
  });
}

export async function gitRemoteAdd(name: string, url: string): Promise<GitActionResult> {
  const bad = badName('Remote name', name) ?? badName('Remote URL', url);
  if (bad) return bad;
  return inRepo(async repoPath => {
    await runGit(repoPath, ['remote', 'add', name.trim(), url.trim()]);
    return { ok: true as const, message: `Added remote ${name.trim()}` };
  });
}

export async function gitRemoteRemove(name: string): Promise<GitActionResult> {
  const bad = badName('Remote name', name);
  if (bad) return bad;
  return inRepo(async repoPath => {
    await runGit(repoPath, ['remote', 'remove', name.trim()]);
    return { ok: true as const, message: `Removed remote ${name.trim()}` };
  });
}

export async function gitFetch(remote?: string): Promise<GitActionResult> {
  const bad = badOptional('Remote name', remote);
  if (bad) return bad;
  return inRepo(async repoPath => {
    await runGit(repoPath, remote ? ['fetch', remote] : ['fetch', '--all', '--prune'], 10000);
    return { ok: true as const, message: remote ? `Fetched ${remote}` : 'Fetched all remotes' };
  });
}

export async function gitPull(remote?: string, branch?: string): Promise<GitActionResult> {
  const bad = badOptional('Remote name', remote) ?? badOptional('Branch name', branch);
  if (bad) return bad;
  return inRepo(async repoPath => {
    const args = ['pull'];
    if (remote) args.push(remote);
    if (branch) args.push(branch);
    await runGit(repoPath, args, 12000);
    return {
      ok: true as const,
      message: remote ? `Pulled from ${remote}${branch ? `/${branch}` : ''}` : 'Pulled latest changes',
    };
  });
}

export async function gitPush(remote?: string, branch?: string, setUpstream?: boolean): Promise<GitActionResult> {
  const bad = badOptional('Remote name', remote) ?? badOptional('Branch name', branch);
  if (bad) return bad;
  return inRepo(async repoPath => {
    const args = ['push'];
    if (setUpstream && remote && branch) args.push('-u');
    if (remote) args.push(remote);
    if (branch) args.push(branch);
    await runGit(repoPath, args, 12000);
    return {
      ok: true as const,
      message: remote ? `Pushed to ${remote}${branch ? `/${branch}` : ''}` : 'Pushed changes',
    };
  });
}

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
    const modifiedFiles = lines.map(line => {
      const rawPath = line.slice(3).trim();
      const renameParts = rawPath.split(' -> ');
      return (renameParts[renameParts.length - 1] || rawPath).replace(/^"|"$/g, '');
    });
    return {
      ok: true as const,
      branch: branchRaw.trim() || 'detached',
      modifiedCount: modifiedFiles.length,
      modifiedFiles,
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
    const raw = await runGit(repoPath, ['log', '--graph', '--decorate', '--oneline', `--max-count=${maxCount}`], 3200);
    return { ok: true as const, lines: raw.split(/\r?\n/).filter(Boolean) };
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
  if (!name.trim()) return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Branch name is required.' };
  return inRepo(async repoPath => {
    await runGit(repoPath, ['checkout', name.trim()], 4200);
    return { ok: true as const, message: `Switched to ${name.trim()}` };
  });
}

export async function gitCreateBranch(name: string): Promise<GitActionResult> {
  if (!name.trim()) return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Branch name is required.' };
  return inRepo(async repoPath => {
    await runGit(repoPath, ['checkout', '-b', name.trim()], 4200);
    return { ok: true as const, message: `Created and switched to ${name.trim()}` };
  });
}

export async function gitRemoteAdd(name: string, url: string): Promise<GitActionResult> {
  if (!name.trim() || !url.trim()) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Remote name and URL are required.' };
  }
  return inRepo(async repoPath => {
    await runGit(repoPath, ['remote', 'add', name.trim(), url.trim()]);
    return { ok: true as const, message: `Added remote ${name.trim()}` };
  });
}

export async function gitRemoteRemove(name: string): Promise<GitActionResult> {
  if (!name.trim()) return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Remote name is required.' };
  return inRepo(async repoPath => {
    await runGit(repoPath, ['remote', 'remove', name.trim()]);
    return { ok: true as const, message: `Removed remote ${name.trim()}` };
  });
}

export async function gitFetch(remote?: string): Promise<GitActionResult> {
  return inRepo(async repoPath => {
    await runGit(repoPath, remote ? ['fetch', remote] : ['fetch', '--all', '--prune'], 10000);
    return { ok: true as const, message: remote ? `Fetched ${remote}` : 'Fetched all remotes' };
  });
}

export async function gitPull(remote?: string, branch?: string): Promise<GitActionResult> {
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

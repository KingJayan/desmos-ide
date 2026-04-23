import {
  app, BrowserWindow, ipcMain, dialog, Menu,
  type MenuItemConstructorOptions,
} from 'electron';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

type AIProvider = 'openai-compatible' | 'openrouter' | 'ollama';
type AIMessage = { role: 'user' | 'assistant'; content: string };
type AIConfig = { provider: AIProvider; model: string; baseUrl: string; apiKey: string };
const execFileAsync = promisify(execFile);

type GitStatusOk = {
  ok: true;
  branch: string;
  modifiedCount: number;
  modifiedFiles: string[];
};

type GitStatusErr = {
  ok: false;
  errorCode: string;
  message: string;
};

type GitStatusResult = GitStatusOk | GitStatusErr;

type GitBranchInfo = {
  name: string;
  current: boolean;
  upstream: string | null;
  tracking: string | null;
};

type GitBranchesOk = {
  ok: true;
  currentBranch: string;
  branches: GitBranchInfo[];
};

type GitHistoryOk = {
  ok: true;
  lines: string[];
};

type GitRemoteInfo = {
  name: string;
  fetchUrl: string;
  pushUrl: string;
};

type GitRemotesOk = {
  ok: true;
  remotes: GitRemoteInfo[];
};

type GitActionOk = {
  ok: true;
  message: string;
};

type GitCommonErr = {
  ok: false;
  errorCode: string;
  message: string;
};

type GitBranchesResult = GitBranchesOk | GitCommonErr;
type GitHistoryResult = GitHistoryOk | GitCommonErr;
type GitRemotesResult = GitRemotesOk | GitCommonErr;
type GitActionResult = GitActionOk | GitCommonErr;

const PROVIDER_DEFAULTS: Record<AIProvider, { model: string; baseUrl: string }> = {
  'openai-compatible': { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  openrouter: { model: 'openai/gpt-4o-mini', baseUrl: 'https://openrouter.ai/api/v1' },
  ollama: { model: 'llama3.2', baseUrl: 'http://127.0.0.1:11434/v1' },
};

function sanitizeMessages(raw: unknown): AIMessage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(m => m && typeof m === 'object' && typeof (m as Record<string,unknown>).content === 'string'
      && ((m as Record<string,unknown>).role === 'user' || (m as Record<string,unknown>).role === 'assistant'))
    .slice(0, 100) as AIMessage[];
}

function sanitizeProvider(raw: unknown): AIProvider {
  if (raw === 'openai-compatible' || raw === 'openrouter' || raw === 'ollama') return raw;
  return 'openai-compatible';
}

function sanitizeBaseUrl(provider: AIProvider, raw: unknown): string {
  const fallback = PROVIDER_DEFAULTS[provider].baseUrl;
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  const value = raw.trim();
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function sanitizeConfig(raw: unknown): AIConfig {
  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const provider = sanitizeProvider(obj.provider);
  return {
    provider,
    model: typeof obj.model === 'string' && obj.model.trim() ? obj.model.trim() : PROVIDER_DEFAULTS[provider].model,
    baseUrl: sanitizeBaseUrl(provider, obj.baseUrl),
    apiKey: typeof obj.apiKey === 'string' ? obj.apiKey.trim() : '',
  };
}

function sanitizeMemories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(m => typeof m === 'string').slice(0, 50) as string[];
}

function resolveApiKey(config: AIConfig): string {
  if (config.apiKey) return config.apiKey;
  if (config.provider === 'openrouter') return process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
  if (config.provider === 'openai-compatible') return process.env.OPENAI_API_KEY || '';
  return process.env.OLLAMA_API_KEY || '';
}

function toChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

function toProviderErrorMessage(err: unknown, config: AIConfig): string {
  const text = String(err);
  if (text.includes('401')) return 'Authentication failed (401). Check provider API key or environment fallback.';
  if (text.includes('403')) return 'Request forbidden (403). Check provider permissions and model access.';
  if (text.includes('404')) return `Endpoint not found (404): ${toChatUrl(config.baseUrl)}`;
  if (text.includes('429')) return 'Rate limit reached (429). Retry after a short delay.';
  if (config.provider === 'ollama' && (text.includes('ECONNREFUSED') || text.includes('fetch failed'))) {
    return 'Cannot connect to Ollama. Start Ollama and verify base URL (default http://127.0.0.1:11434/v1).';
  }
  return `AI request failed: ${text}`;
}

function logAiError(scope: string, reqId: string, config: AIConfig, err: unknown): void {
  console.error(`[${scope}]`, {
    reqId,
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    error: String(err),
  });
}

async function streamOpenAICompatible(
  event: Electron.IpcMainEvent,
  reqId: string,
  config: AIConfig,
  messages: AIMessage[],
  systemText: string,
): Promise<void> {
  const apiKey = resolveApiKey(config);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://desmos-ide.local';
    headers['X-Title'] = 'Desmos IDE';
  }

  const response = await fetch(toChatUrl(config.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      stream: true,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemText },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${bodyText.slice(0, 400)}`);
  }
  if (!response.body) throw new Error('Empty response body from provider');

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let splitAt = buffer.indexOf('\n\n');
    while (splitAt >= 0) {
      const rawEvent = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);

      const lines = rawEvent.split(/\r?\n/);
      const payload = lines
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('');

      if (!payload) {
        splitAt = buffer.indexOf('\n\n');
        continue;
      }
      if (payload === '[DONE]') {
        splitAt = buffer.indexOf('\n\n');
        continue;
      }

      try {
        const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
        const chunk = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '';
        if (chunk) event.sender.send('ai:chunk', { reqId, text: chunk });
      } catch {
      }

      splitAt = buffer.indexOf('\n\n');
    }
  }
}

async function completeOpenAICompatible(
  config: AIConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Promise<string> {
  const apiKey = resolveApiKey(config);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://desmos-ide.local';
    headers['X-Title'] = 'Desmos IDE';
  }
  const response = await fetch(toChatUrl(config.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      stream: false,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages,
    }),
  });
  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${bodyText.slice(0, 400)}`);
  }
  const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return (json.choices?.[0]?.message?.content || '').trim();
}

function fallbackCompact(messages: AIMessage[]): string {
  const latest = messages.slice(-8).map(m => `${m.role}: ${m.content}`).join('\n');
  return latest || 'No conversation to summarize.';
}

let gitRepoPathCache: string | null = null;

async function resolveGitRepoPath(): Promise<string | null> {
  if (gitRepoPathCache) return gitRepoPathCache;
  const appPath = app.getAppPath();
  const candidates = Array.from(new Set([
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
    } catch {
    }
  }
  return null;
}

async function getGitStatus(): Promise<GitStatusResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    const [{ stdout: branchRaw }, { stdout: statusRaw }] = await Promise.all([
      execFileAsync('git', ['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'], {
        timeout: 1800,
        maxBuffer: 512 * 1024,
      }),
      execFileAsync('git', ['-C', repoPath, 'status', '--porcelain', '--untracked-files=all'], {
        timeout: 1800,
        maxBuffer: 512 * 1024,
      }),
    ]);

    const branch = branchRaw.trim() || 'detached';
    const lines = statusRaw
      .split(/\r?\n/)
      .map(line => line.trimEnd())
      .filter(Boolean);

    const modifiedFiles = lines.map(line => {
      const rawPath = line.slice(3).trim();
      const renameParts = rawPath.split(' -> ');
      return (renameParts[renameParts.length - 1] || rawPath).replace(/^"|"$/g, '');
    });

    return {
      ok: true,
      branch,
      modifiedCount: modifiedFiles.length,
      modifiedFiles,
    };
  } catch (err) {
    const text = String(err);
    if (text.includes('not a git repository')) {
      gitRepoPathCache = null;
      return {
        ok: false,
        errorCode: 'NO_REPO',
        message: 'Current project is not a Git repository.',
      };
    }
    return {
      ok: false,
      errorCode: 'GIT_ERROR',
      message: text,
    };
  }
}

function gitErrorResult(err: unknown): GitCommonErr {
  const text = String(err);
  if (text.includes('not a git repository')) {
    gitRepoPathCache = null;
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'Current project is not a Git repository.',
    };
  }
  return {
    ok: false,
    errorCode: 'GIT_ERROR',
    message: text,
  };
}

async function runGit(repoPath: string, args: string[], timeout = 2400): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repoPath, ...args], {
    timeout,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

async function getGitBranches(): Promise<GitBranchesResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    const [branchRaw, listRaw] = await Promise.all([
      runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
      runGit(repoPath, ['branch', '--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:trackshort)']),
    ]);
    const currentBranch = branchRaw.trim() || 'detached';
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
    return { ok: true, currentBranch, branches };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function getGitHistory(limit: number): Promise<GitHistoryResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  const maxCount = Number.isFinite(limit) ? Math.max(10, Math.min(120, Math.floor(limit))) : 40;
  try {
    const raw = await runGit(repoPath, ['log', '--graph', '--decorate', '--oneline', `--max-count=${maxCount}`], 3200);
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return { ok: true, lines };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function getGitRemotes(): Promise<GitRemotesResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    const raw = await runGit(repoPath, ['remote', '-v']);
    const map = new Map<string, GitRemoteInfo>();
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (!m) continue;
      const name = m[1];
      const url = m[2];
      const mode = m[3];
      const existing = map.get(name) ?? { name, fetchUrl: '', pushUrl: '' };
      if (mode === 'fetch') existing.fetchUrl = url;
      if (mode === 'push') existing.pushUrl = url;
      map.set(name, existing);
    }
    return { ok: true, remotes: Array.from(map.values()) };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function gitCheckoutBranch(name: string): Promise<GitActionResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    await runGit(repoPath, ['checkout', name], 4200);
    return { ok: true, message: `Switched to ${name}` };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function gitCreateBranch(name: string): Promise<GitActionResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    await runGit(repoPath, ['checkout', '-b', name], 4200);
    return { ok: true, message: `Created and switched to ${name}` };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function gitRemoteAdd(name: string, url: string): Promise<GitActionResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    await runGit(repoPath, ['remote', 'add', name, url]);
    return { ok: true, message: `Added remote ${name}` };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function gitRemoteRemove(name: string): Promise<GitActionResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    await runGit(repoPath, ['remote', 'remove', name]);
    return { ok: true, message: `Removed remote ${name}` };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function gitFetch(remote?: string): Promise<GitActionResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    const args = remote ? ['fetch', remote] : ['fetch', '--all', '--prune'];
    await runGit(repoPath, args, 10000);
    return { ok: true, message: remote ? `Fetched ${remote}` : 'Fetched all remotes' };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function gitPull(remote?: string, branch?: string): Promise<GitActionResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    const args = ['pull'];
    if (remote) args.push(remote);
    if (branch) args.push(branch);
    await runGit(repoPath, args, 12000);
    return { ok: true, message: remote ? `Pulled from ${remote}${branch ? `/${branch}` : ''}` : 'Pulled latest changes' };
  } catch (err) {
    return gitErrorResult(err);
  }
}

async function gitPush(remote?: string, branch?: string, setUpstream?: boolean): Promise<GitActionResult> {
  const repoPath = await resolveGitRepoPath();
  if (!repoPath) {
    return {
      ok: false,
      errorCode: 'NO_REPO',
      message: 'No Git repository found from app working paths.',
    };
  }
  try {
    const args = ['push'];
    if (setUpstream && remote && branch) args.push('-u');
    if (remote) args.push(remote);
    if (branch) args.push(branch);
    await runGit(repoPath, args, 12000);
    return { ok: true, message: remote ? `Pushed to ${remote}${branch ? `/${branch}` : ''}` : 'Pushed changes' };
  } catch (err) {
    return gitErrorResult(err);
  }
}

const DSL_SYSTEM_PROMPT = `You are an AI assistant embedded in Desmos IDE, a coding environment for the Desmos DSL (dsmx). Help users write, transform, and understand dsmx code.

## Desmos DSL Specification

The DSL compiles to Desmos Calculator expressions.

### Statements
- Variable: \`let name = expression\`
- Function: \`fn name(param1, param2) = expression\`
- Point entity: \`point name { center: (x, y) }\`
- Circle entity: \`circle name { center: (x, y), radius: r }\`
- Line (slope-intercept): \`line name { slope: m, intercept: b }\`
- Line (two-point): \`line name { point1: (x1, y1), point2: (x2, y2) }\`
- Point list: \`points name = map(i in [start...end]) { (x_expr, y_expr) }\`

### Expressions
Numbers, identifiers, \`+\`, \`-\`, \`*\`, \`/\`, \`^\`, function calls, tuples \`(x, y)\`, list ranges \`[a...b]\`

### Built-in functions
\`sin\`, \`cos\`, \`tan\`, \`sqrt\`, \`abs\`, \`log\`, \`exp\`, \`floor\`, \`ceil\`, \`round\`, \`mod\`, \`max\`, \`min\`

### Special
- \`time(start, end)\` — animated time variable. Always: \`let t = time(0, 10)\`
- \`map(i in [start...end]) { (expr, expr) }\` — generates a list of points

### Valid examples

\`\`\`dsmx
// Animated sine wave
let t = time(0, 10)
let a = 1
fn wave(x) = a * sin(x + t)
points curve = map(i in [0...100]) {
  (i/10 - 5, wave(i/10 - 5))
}
\`\`\`

\`\`\`dsmx
// Orbiting circles
let t = time(0, 10)
circle orbit { center: (0, 0), radius: 3 }
circle body { center: (cos(t) * 3, sin(t) * 3), radius: 0.3 }
\`\`\`

\`\`\`dsmx
// Rose curve
fn rx(t) = cos(t) * (1 + 0.5 * cos(5 * t))
fn ry(t) = sin(t) * (1 + 0.5 * cos(5 * t))
points rose = map(i in [0...200]) {
  (rx(i/32), ry(i/32))
}
\`\`\`

## Response format

Always respond with:
1. A 1-2 sentence explanation in plain text
2. A complete \`\`\`dsmx code block

## Rules
- Output ONLY valid DSL syntax — no TypeScript, no JSON, no LaTeX, no Desmos expressions
- Prefer entities (circle, point, line) and reusable functions (fn)
- Use \`time()\` for animations, \`map()\` for point lists
- When transforming code: output the COMPLETE new file
- Keep math Desmos-compatible (standard trig/algebra only)`;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();
  buildMenu(win);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('ai:chat', async (event, payload: unknown) => {
  if (!payload || typeof payload !== 'object') return;
  const raw = payload as Record<string, unknown>;
  const reqId = typeof raw.reqId === 'string' ? raw.reqId : '';
  if (!reqId) return;
  const messages = sanitizeMessages(raw.messages);
  const config = sanitizeConfig(raw.config);
  const memories = sanitizeMemories(raw.memories);
  try {
    let systemText = DSL_SYSTEM_PROMPT;
    if (memories.length) {
      systemText = `## Remembered facts\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\n${DSL_SYSTEM_PROMPT}`;
    }

    await streamOpenAICompatible(event, reqId, config, messages, systemText);
    event.sender.send('ai:done', { reqId });
  } catch (err) {
    logAiError('ai:chat', reqId, config, err);
    event.sender.send('ai:error', { reqId, error: toProviderErrorMessage(err, config) });
  }
});

ipcMain.handle('ai:compact', async (_event, payload: unknown) => {
  const raw = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const messages = sanitizeMessages(raw.messages);
  const config = sanitizeConfig(raw.config);
  const memories = sanitizeMemories(raw.memories);
  try {
    const systemText = memories.length
      ? `Summarize this conversation concisely, preserving key facts, decisions, and any code. Keep plain text.\n\nRemembered facts:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
      : 'Summarize this conversation concisely, preserving key facts, decisions, and any code. Keep plain text.';
    const text = await completeOpenAICompatible(
      config,
      [
        { role: 'system', content: systemText },
        ...messages,
        { role: 'user', content: 'Summarize our conversation above.' },
      ],
      1024,
    );
    return text || fallbackCompact(messages);
  } catch (err) {
    logAiError('ai:compact', 'compact', config, err);
    return fallbackCompact(messages);
  }
});

type FileOkResult<T> = { ok: true } & T;
type FileErrResult = { ok: false; canceled?: boolean; errorCode: string; message: string };
type FileResult<T> = FileOkResult<T> | FileErrResult;

function fileError(err: unknown): FileErrResult {
  const e = err as NodeJS.ErrnoException;
  const code = e.code ?? 'UNKNOWN';
  const msgs: Record<string, string> = {
    EACCES: 'Permission denied — check file permissions.',
    ENOENT: 'File not found — it may have been moved or deleted.',
    ENOSPC: 'Disk full — free up space and try again.',
    EISDIR: 'Expected a file but got a directory.',
  };
  return { ok: false, errorCode: code, message: msgs[code] ?? `File error (${code}): ${e.message}` };
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const transient = code === 'EBUSY' || code === 'EAGAIN' || code === 'EMFILE';
      if (!transient || i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

ipcMain.handle('file:open', async (): Promise<FileResult<{ path: string; content: string }>> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [
      { name: 'Desmos DSL', extensions: ['dsmx'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || !filePaths[0]) return { ok: false, canceled: true, errorCode: 'CANCELED', message: '' };
  try {
    const content = await withRetry(() => readFile(filePaths[0], 'utf-8'));
    return { ok: true, path: filePaths[0], content };
  } catch (err) {
    return fileError(err);
  }
});

ipcMain.handle('file:save', async (_event, payload: unknown): Promise<FileResult<{ path: string }>> => {
  if (!payload || typeof payload !== 'object') return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Invalid save payload.' };
  const { path, content } = payload as Record<string, unknown>;
  if (typeof content !== 'string') return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Content must be a string.' };
  if (path !== null && typeof path !== 'string') return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Path must be a string or null.' };
  let savePath = path as string | null;
  if (!savePath) {
    const { canceled, filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'Desmos DSL', extensions: ['dsmx'] }],
      defaultPath: 'untitled.dsmx',
    });
    if (canceled || !filePath) return { ok: false, canceled: true, errorCode: 'CANCELED', message: '' };
    savePath = filePath;
  }
  try {
    await withRetry(() => writeFile(savePath!, content, 'utf-8'));
    return { ok: true, path: savePath! };
  } catch (err) {
    return fileError(err);
  }
});

ipcMain.handle('file:export-json', async (_event, content: unknown): Promise<FileResult<{ path: string }>> => {
  if (typeof content !== 'string') return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Content must be a string.' };
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'Desmos Expressions', extensions: ['json'] }],
    defaultPath: 'expressions.json',
  });
  if (canceled || !filePath) return { ok: false, canceled: true, errorCode: 'CANCELED', message: '' };
  try {
    await withRetry(() => writeFile(filePath, content, 'utf-8'));
    return { ok: true, path: filePath };
  } catch (err) {
    return fileError(err);
  }
});

ipcMain.handle('git:status', async (): Promise<GitStatusResult> => getGitStatus());
ipcMain.handle('git:branches', async (): Promise<GitBranchesResult> => getGitBranches());
ipcMain.handle('git:history', async (_event, limit?: unknown): Promise<GitHistoryResult> =>
  getGitHistory(typeof limit === 'number' ? limit : 40),
);
ipcMain.handle('git:remotes', async (): Promise<GitRemotesResult> => getGitRemotes());
ipcMain.handle('git:checkout-branch', async (_event, name?: unknown): Promise<GitActionResult> => {
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Branch name is required.' };
  }
  return gitCheckoutBranch(name.trim());
});
ipcMain.handle('git:create-branch', async (_event, name?: unknown): Promise<GitActionResult> => {
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Branch name is required.' };
  }
  return gitCreateBranch(name.trim());
});
ipcMain.handle('git:remote-add', async (_event, payload?: unknown): Promise<GitActionResult> => {
  const obj = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  const url = typeof obj.url === 'string' ? obj.url.trim() : '';
  if (!name || !url) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Remote name and URL are required.' };
  }
  return gitRemoteAdd(name, url);
});
ipcMain.handle('git:remote-remove', async (_event, name?: unknown): Promise<GitActionResult> => {
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, errorCode: 'BAD_PAYLOAD', message: 'Remote name is required.' };
  }
  return gitRemoteRemove(name.trim());
});
ipcMain.handle('git:fetch', async (_event, remote?: unknown): Promise<GitActionResult> =>
  gitFetch(typeof remote === 'string' && remote.trim() ? remote.trim() : undefined),
);
ipcMain.handle('git:pull', async (_event, payload?: unknown): Promise<GitActionResult> => {
  const obj = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const remote = typeof obj.remote === 'string' && obj.remote.trim() ? obj.remote.trim() : undefined;
  const branch = typeof obj.branch === 'string' && obj.branch.trim() ? obj.branch.trim() : undefined;
  return gitPull(remote, branch);
});
ipcMain.handle('git:push', async (_event, payload?: unknown): Promise<GitActionResult> => {
  const obj = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const remote = typeof obj.remote === 'string' && obj.remote.trim() ? obj.remote.trim() : undefined;
  const branch = typeof obj.branch === 'string' && obj.branch.trim() ? obj.branch.trim() : undefined;
  const setUpstream = Boolean(obj.setUpstream);
  return gitPush(remote, branch, setUpstream);
});

function buildMenu(win: BrowserWindow): void {
  const send = (ch: string) => () => win.webContents.send(ch);
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New',      accelerator: 'CmdOrCtrl+N',       click: send('menu:new') },
        { label: 'Open…',    accelerator: 'CmdOrCtrl+O',       click: send('menu:open') },
        { label: 'Save',     accelerator: 'CmdOrCtrl+S',       click: send('menu:save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: send('menu:saveAs') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'toggleDevTools' },
        { role: 'reload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'quit' }],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

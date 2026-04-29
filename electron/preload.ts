import { contextBridge, ipcRenderer } from 'electron';

type AIProvider = 'openai-compatible' | 'openrouter' | 'ollama' | 'github-copilot';
type AIConfig = { provider: AIProvider; model: string; baseUrl: string; apiKey: string };
type GitStatusResult =
  | { ok: true; branch: string; modifiedCount: number; modifiedFiles: string[] }
  | { ok: false; errorCode: string; message: string };
type GitBranchesResult =
  | { ok: true; currentBranch: string; branches: Array<{ name: string; current: boolean; upstream: string | null; tracking: string | null }> }
  | { ok: false; errorCode: string; message: string };
type GitHistoryResult =
  | { ok: true; lines: string[] }
  | { ok: false; errorCode: string; message: string };
type GitRemotesResult =
  | { ok: true; remotes: Array<{ name: string; fetchUrl: string; pushUrl: string }> }
  | { ok: false; errorCode: string; message: string };
type GitActionResult =
  | { ok: true; message: string }
  | { ok: false; errorCode: string; message: string };

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () =>
    ipcRenderer.invoke('file:open') as Promise<
      | { ok: true; path: string; content: string }
      | { ok: false; canceled?: boolean; errorCode: string; message: string }
    >,
  saveFile: (path: string | null, content: string) =>
    ipcRenderer.invoke('file:save', { path, content }) as Promise<
      | { ok: true; path: string }
      | { ok: false; canceled?: boolean; errorCode: string; message: string }
    >,
  exportJson: (content: string) =>
    ipcRenderer.invoke('file:export-json', content) as Promise<
      | { ok: true; path: string }
      | { ok: false; canceled?: boolean; errorCode: string; message: string }
    >,
  onMenuNew:    (cb: () => void) => ipcRenderer.on('menu:new',    () => cb()),
  onMenuOpen:   (cb: () => void) => ipcRenderer.on('menu:open',   () => cb()),
  onMenuSave:   (cb: () => void) => ipcRenderer.on('menu:save',   () => cb()),
  onMenuSaveAs: (cb: () => void) => ipcRenderer.on('menu:saveAs', () => cb()),

  aiChat: (reqId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>, config: AIConfig, memories: string[]) =>
    ipcRenderer.send('ai:chat', { reqId, messages, config, memories }),
  aiCompact: (messages: Array<{ role: 'user' | 'assistant'; content: string }>, config: AIConfig, memories: string[]) =>
    ipcRenderer.invoke('ai:compact', { messages, config, memories }) as Promise<string>,
  gitStatus: () =>
    ipcRenderer.invoke('git:status') as Promise<GitStatusResult>,
  gitBranches: () =>
    ipcRenderer.invoke('git:branches') as Promise<GitBranchesResult>,
  gitHistory: (limit = 40) =>
    ipcRenderer.invoke('git:history', limit) as Promise<GitHistoryResult>,
  gitRemotes: () =>
    ipcRenderer.invoke('git:remotes') as Promise<GitRemotesResult>,
  gitCheckoutBranch: (name: string) =>
    ipcRenderer.invoke('git:checkout-branch', name) as Promise<GitActionResult>,
  gitCreateBranch: (name: string) =>
    ipcRenderer.invoke('git:create-branch', name) as Promise<GitActionResult>,
  gitRemoteAdd: (name: string, url: string) =>
    ipcRenderer.invoke('git:remote-add', { name, url }) as Promise<GitActionResult>,
  gitRemoteRemove: (name: string) =>
    ipcRenderer.invoke('git:remote-remove', name) as Promise<GitActionResult>,
  gitFetch: (remote?: string) =>
    ipcRenderer.invoke('git:fetch', remote) as Promise<GitActionResult>,
  gitPull: (remote?: string, branch?: string) =>
    ipcRenderer.invoke('git:pull', { remote, branch }) as Promise<GitActionResult>,
  gitPush: (remote?: string, branch?: string, setUpstream = false) =>
    ipcRenderer.invoke('git:push', { remote, branch, setUpstream }) as Promise<GitActionResult>,
  copilotStartDeviceFlow: () =>
    ipcRenderer.invoke('copilot:start-device-flow') as Promise<{
      device_code: string; user_code: string; verification_uri: string;
      expires_in: number; interval: number;
    }>,
  copilotPollDeviceFlow: (deviceCode: string) =>
    ipcRenderer.invoke('copilot:poll-device-flow', { deviceCode }) as Promise<
      | { ok: true; githubToken: string }
      | { ok: false; pending: boolean; error: string }
    >,
  copilotRevoke: () =>
    ipcRenderer.invoke('copilot:revoke') as Promise<{ ok: true }>,
  openExternal: (url: string) =>
    ipcRenderer.invoke('shell:open-external', url) as Promise<void>,
  onAiChunk: (cb: (reqId: string, text: string) => void) =>
    ipcRenderer.on('ai:chunk', (_e, data: { reqId: string; text: string }) => cb(data.reqId, data.text)),
  onAiDone:  (cb: (reqId: string) => void) =>
    ipcRenderer.on('ai:done',  (_e, data: { reqId: string }) => cb(data.reqId)),
  onAiError: (cb: (reqId: string, error: string) => void) =>
    ipcRenderer.on('ai:error', (_e, data: { reqId: string; error: string }) => cb(data.reqId, data.error)),
  watchFile: (path: string) =>
    ipcRenderer.invoke('file:watch', path) as Promise<void>,
  unwatchFile: (path: string) =>
    ipcRenderer.invoke('file:unwatch', path) as Promise<void>,
  onFileChanged: (cb: (path: string, content: string) => void) =>
    ipcRenderer.on('file:changed', (_e, data: { path: string; content: string }) => cb(data.path, data.content)),
});

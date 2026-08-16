import Electrobun, { Electroview } from 'electrobun/view';
import type { AIConfig, AIMessage, DesmosIdeRPC } from '../src/shared/rpc-schema';

type Listener<T extends unknown[]> = (...args: T) => void;

/** registers a listener and hands back the function that removes it again */
function subscribe<T extends unknown[]>(list: Listener<T>[], cb: Listener<T>): () => void {
  list.push(cb);
  return () => {
    const i = list.indexOf(cb);
    if (i !== -1) list.splice(i, 1);
  };
}

const aiChunkCbs: Listener<[string, string]>[] = [];
const aiDoneCbs: Listener<[string]>[] = [];
const aiErrorCbs: Listener<[string, string]>[] = [];
const fileChangedCbs: Listener<[string, string]>[] = [];
const menuCbs: Record<'new' | 'open' | 'save' | 'saveAs' | 'exportTex', Listener<[]>[]> = {
  new: [], open: [], save: [], saveAs: [], exportTex: [],
};
const menuRecentCbs: Listener<[string]>[] = [];

const rpc = Electroview.defineRPC<DesmosIdeRPC>({
  maxRequestTime: 60_000,
  handlers: {
    requests: {},
    messages: {
      aiChunk: ({ reqId, text }) => aiChunkCbs.forEach(cb => cb(reqId, text)),
      aiDone: ({ reqId }) => aiDoneCbs.forEach(cb => cb(reqId)),
      aiError: ({ reqId, error }) => aiErrorCbs.forEach(cb => cb(reqId, error)),
      fileChanged: ({ path, content }) => fileChangedCbs.forEach(cb => cb(path, content)),
      menuNew: () => menuCbs.new.forEach(cb => cb()),
      menuOpen: () => menuCbs.open.forEach(cb => cb()),
      menuSave: () => menuCbs.save.forEach(cb => cb()),
      menuSaveAs: () => menuCbs.saveAs.forEach(cb => cb()),
      menuExportTex: () => menuCbs.exportTex.forEach(cb => cb()),
      menuOpenRecent: ({ path }) => menuRecentCbs.forEach(cb => cb(path)),
    },
  },
});

// outside the electrobun webview there is no bun bridge, so the ui must still load
let bridgeReady = false;
try {
  new Electrobun.Electroview({ rpc });
  bridgeReady = true;
} catch (err) {
  console.warn('electrobun bridge unavailable — file, git and ai actions are disabled', err);
}

// keeps the electron-era surface so the ui modules need no changes
export const electronAPI = {
  openFile: () => rpc.request.openFile(),
  saveFile: (path: string | null, content: string) => rpc.request.saveFile({ path, content }),
  exportJson: (content: string) => rpc.request.exportJson({ content }),
  exportTex: (content: string, defaultName: string) => rpc.request.exportTex({ content, defaultName }),

  onMenuNew: (cb: () => void) => subscribe(menuCbs.new, cb),
  onMenuOpen: (cb: () => void) => subscribe(menuCbs.open, cb),
  onMenuSave: (cb: () => void) => subscribe(menuCbs.save, cb),
  onMenuSaveAs: (cb: () => void) => subscribe(menuCbs.saveAs, cb),
  onMenuExportTex: (cb: () => void) => subscribe(menuCbs.exportTex, cb),
  onMenuOpenRecent: (cb: (path: string) => void) => subscribe(menuRecentCbs, cb),

  aiChat: (reqId: string, messages: AIMessage[], config: AIConfig, memories: string[]) =>
    rpc.send.aiChat({ reqId, messages, config, memories }),
  aiCompact: (messages: AIMessage[], config: AIConfig, memories: string[]) =>
    rpc.request.aiCompact({ messages, config, memories }),
  aiTitle: (messages: AIMessage[], config: AIConfig) => rpc.request.aiTitle({ messages, config }),

  setGitContext: (path: string | null) => rpc.request.setGitContext({ path }),
  gitStatus: () => rpc.request.gitStatus(),
  gitBranches: () => rpc.request.gitBranches(),
  gitHistory: (limit = 40) => rpc.request.gitHistory({ limit }),
  gitRemotes: () => rpc.request.gitRemotes(),
  gitCheckoutBranch: (name: string) => rpc.request.gitCheckoutBranch({ name }),
  gitCreateBranch: (name: string) => rpc.request.gitCreateBranch({ name }),
  gitRemoteAdd: (name: string, url: string) => rpc.request.gitRemoteAdd({ name, url }),
  gitRemoteRemove: (name: string) => rpc.request.gitRemoteRemove({ name }),
  gitFetch: (remote?: string) => rpc.request.gitFetch({ remote }),
  gitPull: (remote?: string, branch?: string) => rpc.request.gitPull({ remote, branch }),
  gitPush: (remote?: string, branch?: string, setUpstream = false) =>
    rpc.request.gitPush({ remote, branch, setUpstream }),

  copilotStartDeviceFlow: () => rpc.request.copilotStartDeviceFlow(),
  copilotPollDeviceFlow: (deviceCode: string) => rpc.request.copilotPollDeviceFlow({ deviceCode }),
  copilotRevoke: () => rpc.request.copilotRevoke(),
  copilotGetModels: (githubToken: string) => rpc.request.copilotGetModels({ githubToken }),

  openExternal: (url: string) => rpc.request.openExternal({ url }),

  confirm: (message: string) => rpc.request.confirm({ message }).catch(() => confirm(message)),
  prompt: (message: string, defaultValue = '') =>
    rpc.request.promptInput({ message, defaultValue }).catch(() => prompt(message, defaultValue)),

  onAiChunk: (cb: (reqId: string, text: string) => void) => subscribe(aiChunkCbs, cb),
  onAiDone: (cb: (reqId: string) => void) => subscribe(aiDoneCbs, cb),
  onAiError: (cb: (reqId: string, error: string) => void) => subscribe(aiErrorCbs, cb),

  setRecentFiles: (paths: string[]) => rpc.request.setRecentFiles({ paths }),
  readFileAt: (path: string) => rpc.request.readFileAt({ path }),
  searchFiles: (paths: string[], query: string, useRegex = false) =>
    rpc.request.searchFiles({ paths, query, useRegex }),
  searchFolder: (root: string, query: string, useRegex = false) =>
    rpc.request.searchFolder({ root, query, useRegex }),
  pickFolder: () => rpc.request.pickFolder().catch(() => null),

  // a webview cannot reach the keychain, so every secret goes over the bridge.
  // a bridge failure means no secure store, and the caller falls back.
  secretsAvailable: () => rpc.request.secretsAvailable().catch(() => false),
  secretGet: (account: string) => rpc.request.secretGet({ account }).catch(() => null),
  secretSet: (account: string, value: string) =>
    rpc.request.secretSet({ account, value }).catch(() => false),
  secretDelete: (account: string) => rpc.request.secretDelete({ account }).catch(() => false),

  watchFile: (path: string) => rpc.request.watchFile({ path }),
  unwatchFile: (path: string) => rpc.request.unwatchFile({ path }),
  onFileChanged: (cb: (path: string, content: string) => void) => subscribe(fileChangedCbs, cb),
};

if (bridgeReady) window.electronAPI = electronAPI;

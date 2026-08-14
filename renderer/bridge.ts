import Electrobun, { Electroview } from 'electrobun/view';
import type { AIConfig, AIMessage, DesmosIdeRPC } from '../src/shared/rpc-schema';

type Listener<T extends unknown[]> = (...args: T) => void;

const aiChunkCbs: Listener<[string, string]>[] = [];
const aiDoneCbs: Listener<[string]>[] = [];
const aiErrorCbs: Listener<[string, string]>[] = [];
const fileChangedCbs: Listener<[string, string]>[] = [];
const menuCbs: Record<'new' | 'open' | 'save' | 'saveAs', Listener<[]>[]> = {
  new: [], open: [], save: [], saveAs: [],
};

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
    },
  },
});

new Electrobun.Electroview({ rpc });

// keeps the electron-era surface so the ui modules need no changes
export const electronAPI = {
  openFile: () => rpc.request.openFile(),
  saveFile: (path: string | null, content: string) => rpc.request.saveFile({ path, content }),
  exportJson: (content: string) => rpc.request.exportJson({ content }),

  onMenuNew: (cb: () => void) => { menuCbs.new.push(cb); },
  onMenuOpen: (cb: () => void) => { menuCbs.open.push(cb); },
  onMenuSave: (cb: () => void) => { menuCbs.save.push(cb); },
  onMenuSaveAs: (cb: () => void) => { menuCbs.saveAs.push(cb); },

  aiChat: (reqId: string, messages: AIMessage[], config: AIConfig, memories: string[]) =>
    rpc.send.aiChat({ reqId, messages, config, memories }),
  aiCompact: (messages: AIMessage[], config: AIConfig, memories: string[]) =>
    rpc.request.aiCompact({ messages, config, memories }),

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

  onAiChunk: (cb: (reqId: string, text: string) => void) => { aiChunkCbs.push(cb); },
  onAiDone: (cb: (reqId: string) => void) => { aiDoneCbs.push(cb); },
  onAiError: (cb: (reqId: string, error: string) => void) => { aiErrorCbs.push(cb); },

  watchFile: (path: string) => rpc.request.watchFile({ path }),
  unwatchFile: (path: string) => rpc.request.unwatchFile({ path }),
  onFileChanged: (cb: (path: string, content: string) => void) => { fileChangedCbs.push(cb); },
};

window.electronAPI = electronAPI;

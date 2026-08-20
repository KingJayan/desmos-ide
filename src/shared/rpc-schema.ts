/**
 * replaces Electron `ipcMain.handle` / `ipcRenderer.invoke` channel names with a schema that both sides import
 */

import type { InstalledPlugin, PluginState, RegistryIndex } from '../plugin/manifest';

export type AIProvider = 'openai-compatible' | 'openrouter' | 'ollama' | 'github-copilot';
export type AIMessage = { role: 'user' | 'assistant'; content: string };
export type AIConfig = { provider: AIProvider; model: string; baseUrl: string; apiKey: string };

export type FileResult<T> =
  | ({ ok: true } & T)
  | { ok: false; canceled?: boolean; errorCode: string; message: string };

export type SearchHit = { path: string; line: number; col: number; text: string };

export type SearchResult =
  | { ok: true; hits: SearchHit[]; scanned: number }
  | { ok: false; errorCode: string; message: string };

export type GitStatusResult =
  | { ok: true; branch: string; modifiedCount: number; modifiedFiles: string[] }
  | { ok: false; errorCode: string; message: string };

export type GitBranchInfo = {
  name: string;
  current: boolean;
  upstream: string | null;
  tracking: string | null;
};

export type GitBranchesResult =
  | { ok: true; currentBranch: string; branches: GitBranchInfo[] }
  | { ok: false; errorCode: string; message: string };

export type GitHistoryResult =
  | { ok: true; lines: string[] }
  | { ok: false; errorCode: string; message: string };

export type GitRemoteInfo = { name: string; fetchUrl: string; pushUrl: string };

export type GitRemotesResult =
  | { ok: true; remotes: GitRemoteInfo[] }
  | { ok: false; errorCode: string; message: string };

export type GitActionResult =
  | { ok: true; message: string }
  | { ok: false; errorCode: string; message: string };

export type CopilotDeviceFlow = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export type CopilotPollResult =
  | { ok: true; githubToken: string }
  | { ok: false; pending: boolean; error: string };

export type CopilotModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

export type PluginActionResult =
  | { ok: true }
  | { ok: false; message: string };

export type DesmosIdeRPC = {
  bun: {
    requests: {
      openFile: { params: void; response: FileResult<{ path: string; content: string }> };
      saveFile: { params: { path: string | null; content: string }; response: FileResult<{ path: string }> };
      exportJson: { params: { content: string }; response: FileResult<{ path: string }> };
      exportTex: { params: { content: string; defaultName: string }; response: FileResult<{ path: string }> };
      exportImage: { params: { data: string; defaultName: string; format: 'png' | 'svg' }; response: FileResult<{ path: string }> };
      watchFile: { params: { path: string }; response: void };
      unwatchFile: { params: { path: string }; response: void };
      readFileAt: { params: { path: string }; response: FileResult<{ path: string; content: string }> };
      searchFiles: { params: { paths: string[]; query: string; useRegex: boolean }; response: SearchResult };
      searchFolder: { params: { root: string; query: string; useRegex: boolean }; response: SearchResult };
      pickFolder: { params: void; response: string | null };

      secretsAvailable: { params: void; response: boolean };
      secretGet: { params: { account: string }; response: string | null };
      secretSet: { params: { account: string; value: string }; response: boolean };
      secretDelete: { params: { account: string }; response: boolean };

      aiCompact: { params: { messages: AIMessage[]; config: AIConfig; memories: string[] }; response: string };
      aiTitle: { params: { messages: AIMessage[]; config: AIConfig }; response: string };

      setGitContext: { params: { path: string | null }; response: void };
      gitStatus: { params: void; response: GitStatusResult };
      gitBranches: { params: void; response: GitBranchesResult };
      gitHistory: { params: { limit: number }; response: GitHistoryResult };
      gitRemotes: { params: void; response: GitRemotesResult };
      gitCheckoutBranch: { params: { name: string }; response: GitActionResult };
      gitCreateBranch: { params: { name: string }; response: GitActionResult };
      gitRemoteAdd: { params: { name: string; url: string }; response: GitActionResult };
      gitRemoteRemove: { params: { name: string }; response: GitActionResult };
      gitFetch: { params: { remote?: string }; response: GitActionResult };
      gitPull: { params: { remote?: string; branch?: string }; response: GitActionResult };
      gitPush: { params: { remote?: string; branch?: string; setUpstream?: boolean }; response: GitActionResult };

      copilotStartDeviceFlow: { params: void; response: CopilotDeviceFlow };
      copilotPollDeviceFlow: { params: { deviceCode: string }; response: CopilotPollResult };
      copilotRevoke: { params: void; response: { ok: true } };
      copilotGetModels: { params: { githubToken: string }; response: CopilotModelsResult };

      pluginList: { params: void; response: InstalledPlugin[] };
      pluginSetEnabled: { params: { id: string; enabled: boolean }; response: PluginActionResult };
      pluginUninstall: { params: { id: string }; response: PluginActionResult };
      pluginRegistry: { params: void; response: { ok: true; index: RegistryIndex } | { ok: false; message: string } };
      pluginInstall: { params: { id: string }; response: { ok: true; plugin: InstalledPlugin } | { ok: false; message: string } };
      pluginIcon: { params: { id: string }; response: string | null };
      pluginReadme: { params: { id: string }; response: string | null };
      pluginState: { params: { id: string; workspace: string | null }; response: PluginState };
      pluginStateUpdate: {
        params: { id: string; scope: 'global' | 'workspace'; workspace: string | null; key: string; value: unknown };
        response: boolean;
      };
      pluginStateSync: { params: { id: string; keys: string[] }; response: boolean };
      pluginSecret: { params: { id: string; key: string }; response: string | null };
      pluginSecretStore: { params: { id: string; key: string; value: string }; response: boolean };
      pluginSecretDelete: { params: { id: string; key: string }; response: boolean };

      openExternal: { params: { url: string }; response: void };
      setRecentFiles: { params: { paths: string[] }; response: void };
      confirm: { params: { message: string }; response: boolean };
      promptInput: { params: { message: string; defaultValue: string }; response: string | null };
    };
    messages: {
      aiChat: { reqId: string; messages: AIMessage[]; config: AIConfig; memories: string[] };
    };
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      aiChunk: { reqId: string; text: string };
      aiDone: { reqId: string };
      aiError: { reqId: string; error: string };
      fileChanged: { path: string; content: string };
      menuNew: void;
      menuOpen: void;
      menuSave: void;
      menuSaveAs: void;
      menuExportTex: void;
      menuExportImage: { format: 'png' | 'svg' };
      menuShare: void;
      menuPlugins: void;
      openPluginPage: { id: string };
      menuOpenRecent: { path: string };
    };
  };
};

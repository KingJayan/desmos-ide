/**
 * replaces Electron `ipcMain.handle` / `ipcRenderer.invoke` channel names with a schema that both sides import
 */

export type AIProvider = 'openai-compatible' | 'openrouter' | 'ollama' | 'github-copilot';
export type AIMessage = { role: 'user' | 'assistant'; content: string };
export type AIConfig = { provider: AIProvider; model: string; baseUrl: string; apiKey: string };

export type FileResult<T> =
  | ({ ok: true } & T)
  | { ok: false; canceled?: boolean; errorCode: string; message: string };

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

export type DesmosIdeRPC = {
  bun: {
    requests: {
      openFile: { params: void; response: FileResult<{ path: string; content: string }> };
      saveFile: { params: { path: string | null; content: string }; response: FileResult<{ path: string }> };
      exportJson: { params: { content: string }; response: FileResult<{ path: string }> };
      watchFile: { params: { path: string }; response: void };
      unwatchFile: { params: { path: string }; response: void };

      aiCompact: { params: { messages: AIMessage[]; config: AIConfig; memories: string[] }; response: string };

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

      openExternal: { params: { url: string }; response: void };
    };
    messages: {
      aiChat: { reqId: string; messages: AIMessage[]; config: AIConfig; memories: string[] };
    };
  };
  webview: {
    requests: {};
    messages: {
      aiChunk: { reqId: string; text: string };
      aiDone: { reqId: string };
      aiError: { reqId: string; error: string };
      fileChanged: { path: string; content: string };
      menuNew: void;
      menuOpen: void;
      menuSave: void;
      menuSaveAs: void;
    };
  };
};

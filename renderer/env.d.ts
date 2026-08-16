/// <reference types="vite/client" />

interface Window {
  MonacoEnvironment: {
    getWorker(moduleId: string, label: string): Worker;
  };
  electronAPI?: {
    openFile(): Promise<{ ok: true; path: string; content: string } | { ok: false; canceled?: boolean; errorCode: string; message: string }>;
    saveFile(path: string | null, content: string): Promise<{ ok: true; path: string } | { ok: false; canceled?: boolean; errorCode: string; message: string }>;
    exportJson(content: string): Promise<{ ok: true; path: string } | { ok: false; canceled?: boolean; errorCode: string; message: string }>;
    onMenuNew(cb: () => void): () => void;
    onMenuOpen(cb: () => void): () => void;
    onMenuSave(cb: () => void): () => void;
    onMenuSaveAs(cb: () => void): () => void;
    onMenuOpenRecent(cb: (path: string) => void): () => void;
    setRecentFiles(paths: string[]): Promise<void>;
    aiChat(
      reqId: string,
      messages: Array<{ role: 'user' | 'assistant'; content: string }>,
      config: { provider: 'openai-compatible' | 'openrouter' | 'ollama' | 'github-copilot'; model: string; baseUrl: string; apiKey: string },
      memories: string[],
    ): void;
    aiCompact(
      messages: Array<{ role: 'user' | 'assistant'; content: string }>,
      config: { provider: 'openai-compatible' | 'openrouter' | 'ollama' | 'github-copilot'; model: string; baseUrl: string; apiKey: string },
      memories: string[],
    ): Promise<string>;
    aiTitle(
      messages: Array<{ role: 'user' | 'assistant'; content: string }>,
      config: { provider: 'openai-compatible' | 'openrouter' | 'ollama' | 'github-copilot'; model: string; baseUrl: string; apiKey: string },
    ): Promise<string>;
    copilotStartDeviceFlow(): Promise<{
      device_code: string; user_code: string; verification_uri: string;
      expires_in: number; interval: number;
    }>;
    copilotPollDeviceFlow(deviceCode: string): Promise<
      | { ok: true; githubToken: string }
      | { ok: false; pending: boolean; error: string }
    >;
    copilotRevoke(): Promise<{ ok: true }>;
    copilotGetModels(githubToken: string): Promise<{ ok: true; models: string[] } | { ok: false; error: string }>;
    openExternal(url: string): Promise<void>;
    confirm(message: string): Promise<boolean>;
    prompt(message: string, defaultValue?: string): Promise<string | null>;
    readFileAt(path: string): Promise<{ ok: true; path: string; content: string } | { ok: false; canceled?: boolean; errorCode: string; message: string }>;
    searchFiles(paths: string[], query: string, useRegex?: boolean): Promise<
      | { ok: true; hits: Array<{ path: string; line: number; col: number; text: string }>; scanned: number }
      | { ok: false; errorCode: string; message: string }
    >;
    searchFolder(root: string, query: string, useRegex?: boolean): Promise<
      | { ok: true; hits: Array<{ path: string; line: number; col: number; text: string }>; scanned: number }
      | { ok: false; errorCode: string; message: string }
    >;
    secretsAvailable(): Promise<boolean>;
    secretGet(account: string): Promise<string | null>;
    secretSet(account: string, value: string): Promise<boolean>;
    secretDelete(account: string): Promise<boolean>;
    setGitContext(path: string | null): Promise<void>;
    gitStatus(): Promise<
      | { ok: true; branch: string; modifiedCount: number; modifiedFiles: string[] }
      | { ok: false; errorCode: string; message: string }
    >;
    gitBranches(): Promise<
      | { ok: true; currentBranch: string; branches: Array<{ name: string; current: boolean; upstream: string | null; tracking: string | null }> }
      | { ok: false; errorCode: string; message: string }
    >;
    gitHistory(limit?: number): Promise<
      | { ok: true; lines: string[] }
      | { ok: false; errorCode: string; message: string }
    >;
    gitRemotes(): Promise<
      | { ok: true; remotes: Array<{ name: string; fetchUrl: string; pushUrl: string }> }
      | { ok: false; errorCode: string; message: string }
    >;
    gitCheckoutBranch(name: string): Promise<
      | { ok: true; message: string }
      | { ok: false; errorCode: string; message: string }
    >;
    gitCreateBranch(name: string): Promise<
      | { ok: true; message: string }
      | { ok: false; errorCode: string; message: string }
    >;
    gitRemoteAdd(name: string, url: string): Promise<
      | { ok: true; message: string }
      | { ok: false; errorCode: string; message: string }
    >;
    gitRemoteRemove(name: string): Promise<
      | { ok: true; message: string }
      | { ok: false; errorCode: string; message: string }
    >;
    gitFetch(remote?: string): Promise<
      | { ok: true; message: string }
      | { ok: false; errorCode: string; message: string }
    >;
    gitPull(remote?: string, branch?: string): Promise<
      | { ok: true; message: string }
      | { ok: false; errorCode: string; message: string }
    >;
    gitPush(remote?: string, branch?: string, setUpstream?: boolean): Promise<
      | { ok: true; message: string }
      | { ok: false; errorCode: string; message: string }
    >;
    onAiChunk(cb: (reqId: string, text: string) => void): () => void;
    onAiDone(cb: (reqId: string) => void): () => void;
    onAiError(cb: (reqId: string, error: string) => void): () => void;
    watchFile(path: string): Promise<void>;
    unwatchFile(path: string): Promise<void>;
    onFileChanged(cb: (path: string, content: string) => void): () => void;
  };
}

declare const Desmos: {
  GraphingCalculator(
    el: HTMLElement,
    opts?: Record<string, unknown>,
  ): DesmosCalculator;
};

interface DesmosCalculator {
  setExpression(expr: Record<string, unknown>): void;
  setExpressions(list: Record<string, unknown>[]): void;
  updateSettings(opts: Record<string, unknown>): void;
  removeExpression(ref: { id: string }): void;
  getExpressions(): Record<string, unknown>[];
  destroy(): void;

  selectedExpressionId?: string;
  observe?(property: string, cb: () => void): void;
  unobserve?(property: string): void;
  controller?: { dispatch?(action: Record<string, unknown>): void };

  HelperExpression?(opts: { latex: string }): DesmosHelper;
}

interface DesmosHelper {
  numericValue: number;
  observe(property: string, cb: () => void): void;
  unobserve?(property: string): void;
}

import type { CommandInfo, Contributions } from '../../src/plugin/contributions';

export type { CommandInfo, Contributions };

export interface MacroCall {
  key: string;
  plugin: string;
  macro: string;
  args: (number | string)[];
}

export interface MacroResult {
  key: string;
  dsl: string | null;
  error: string | null;
}

export type CommandAction =
  | { kind: 'insert'; text: string }
  | { kind: 'replace'; text: string }
  | { kind: 'status'; text: string }
  | { kind: 'none' };

export interface LoadedPlugin {
  id: string;
  macros: string[];
  commands: CommandInfo[];
  error: string | null;
}

export type HostCall =
  | 'notify'
  | 'status'
  | 'state.get'
  | 'state.update'
  | 'state.keys'
  | 'state.sync'
  | 'storage.path'
  | 'secrets.get'
  | 'secrets.store'
  | 'secrets.delete'
  | 'editor.text'
  | 'editor.selection'
  | 'editor.insert'
  | 'editor.replace'
  | 'editor.setText'
  | 'app.run';

export interface LoadRequest {
  id: string;
  main: string;
  globalState: Record<string, unknown>;
  workspaceState: Record<string, unknown>;
  storagePath: string | null;
  globalStoragePath: string | null;
}

export interface ViewEvent {
  view: string;
  widget: string;
  value: string | number | boolean | null;
}

export type SandboxRequest =
  | { type: 'load'; plugins: LoadRequest[] }
  | { type: 'expand'; id: number; calls: MacroCall[] }
  | { type: 'command'; id: number; plugin: string; command: string }
  | { type: 'event'; plugin: string; event: ViewEvent }
  | { type: 'hostReply'; id: number; ok: boolean; value?: unknown; error?: string };

export type SandboxResponse =
  | { type: 'loaded'; plugins: LoadedPlugin[] }
  | { type: 'expanded'; id: number; results: MacroResult[] }
  | { type: 'commandDone'; id: number; action: CommandAction; error: string | null }
  | { type: 'contributes'; plugin: string; contributions: unknown }
  | { type: 'commands'; plugin: string; commands: CommandInfo[] }
  | { type: 'host'; id: number; plugin: string; call: HostCall; args: unknown[] };


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

export interface CommandInfo {
  plugin: string;
  id: string;
  label: string;
  description?: string;
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

export type SandboxRequest =
  | { type: 'load'; plugins: { id: string; main: string }[] }
  | { type: 'expand'; id: number; calls: MacroCall[] }
  | { type: 'command'; id: number; plugin: string; command: string };

export type SandboxResponse =
  | { type: 'loaded'; plugins: LoadedPlugin[] }
  | { type: 'expanded'; id: number; results: MacroResult[] }
  | { type: 'commandDone'; id: number; action: CommandAction; error: string | null };

import Sandbox from './sandbox.worker?worker';
import type {
  CommandAction, CommandInfo, LoadedPlugin, MacroCall, MacroResult, SandboxRequest, SandboxResponse,
} from './protocol';
import { applyMacros, findMacros } from '../../src/plugin/macro';
import type { Expanded, MacroError } from '../../src/plugin/macro';
import type { InstalledPlugin } from '../../src/plugin/manifest';

// a plugin runs on every keystroke that reaches a macro, so a slow one is a hung
// editor. past this the worker is killed and rebuilt, and the file compiles without it
const EXPAND_TIMEOUT = 1500;
const COMMAND_TIMEOUT = 3000;

interface Pending {
  resolve: (value: never) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface ExpandResult extends Expanded {
  errors: MacroError[];
}

export class PluginHost {
  private worker: Worker | null = null;
  private installed: InstalledPlugin[] = [];
  private loaded = new Map<string, LoadedPlugin>();
  private macroOwner = new Map<string, string>();
  private pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(private readonly onChange: () => void) {}

  list(): InstalledPlugin[] {
    return this.installed;
  }

  /** what went wrong while a plugin was loading, for the plugin panel to show */
  loadError(id: string): string | null {
    return this.loaded.get(id)?.error ?? null;
  }

  enabled(): InstalledPlugin[] {
    return this.installed.filter(p => p.enabled);
  }

  ids(): string[] {
    return this.enabled().map(p => p.manifest.id);
  }

  /** every enabled plugin's dsl, folded into one prelude */
  prelude(): string {
    return this.enabled()
      .map(p => p.lib)
      .filter((lib): lib is string => !!lib)
      .join('\n');
  }

  commands(): CommandInfo[] {
    return this.enabled().flatMap(p => this.loaded.get(p.manifest.id)?.commands ?? []);
  }

  async refresh(): Promise<void> {
    this.installed = (await window.electronAPI?.pluginList()) ?? [];
    await this.reload();
    this.onChange();
  }

  private reset(): void {
    for (const p of this.pending.values()) clearTimeout(p.timer);
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  private async reload(): Promise<void> {
    this.reset();
    this.loaded.clear();
    this.macroOwner.clear();

    const withCode = this.enabled().filter(p => p.main);
    if (withCode.length === 0) return;

    this.worker = new Sandbox();
    this.worker.addEventListener('message', e => this.onMessage(e as MessageEvent<SandboxResponse>));

    const loaded = await new Promise<LoadedPlugin[]>(resolve => {
      const done = (event: MessageEvent<SandboxResponse>) => {
        if (event.data.type !== 'loaded') return;
        this.worker?.removeEventListener('message', done);
        resolve(event.data.plugins);
      };
      this.worker?.addEventListener('message', done);
      this.send({
        type: 'load',
        plugins: withCode.map(p => ({ id: p.manifest.id, main: p.main! })),
      });
    });

    for (const plugin of loaded) {
      this.loaded.set(plugin.id, plugin);
      // two plugins can name one macro. the first to load owns it, and the second is
      // told so in its panel row rather than silently winning
      for (const macro of plugin.macros) {
        if (!this.macroOwner.has(macro)) this.macroOwner.set(macro, plugin.id);
      }
    }
  }

  private send(msg: SandboxRequest): void {
    this.worker?.postMessage(msg);
  }

  private onMessage(event: MessageEvent<SandboxResponse>): void {
    const msg = event.data;
    if (msg.type === 'loaded') return;

    const waiting = this.pending.get(msg.id);
    if (!waiting) return;
    clearTimeout(waiting.timer);
    this.pending.delete(msg.id);
    waiting.resolve(msg as never);
  }

  private ask<T extends SandboxResponse>(msg: (id: number) => SandboxRequest, ms: number, onTimeout: T): Promise<T> {
    if (!this.worker) return Promise.resolve(onTimeout);
    const id = this.nextId++;
    return new Promise<T>(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // a plugin cannot be interrupted from outside, so the worker goes and the
        // rest of the plugins come back with it
        void this.reload();
        resolve(onTimeout);
      }, ms);
      this.pending.set(id, { resolve: resolve as (value: never) => void, timer });
      this.send(msg(id));
    });
  }

  /** turns every `@macro(...)` into dsl, and reports the ones that could not be */
  async expand(src: string): Promise<ExpandResult> {
    const { sites, errors } = findMacros(src);
    if (sites.length === 0) {
      const plain = applyMacros(src, new Map());
      return { ...plain, errors };
    }

    const calls: MacroCall[] = [];
    const unknown: MacroError[] = [];
    for (const site of sites) {
      const plugin = this.macroOwner.get(site.macro);
      if (!plugin) {
        unknown.push({
          line: site.line,
          col: 1,
          message: `No enabled plugin provides @${site.macro}`,
        });
        continue;
      }
      calls.push({ key: String(site.line), plugin, macro: site.macro, args: site.args });
    }

    let results: MacroResult[] = [];
    if (calls.length > 0) {
      const reply = await this.ask<Extract<SandboxResponse, { type: 'expanded' }>>(
        id => ({ type: 'expand', id, calls }),
        EXPAND_TIMEOUT,
        {
          type: 'expanded',
          id: 0,
          results: calls.map(c => ({ key: c.key, dsl: null, error: 'the plugin took too long and was stopped' })),
        },
      );
      results = reply.results;
    }

    const expansions = new Map<number, string>();
    const failed: MacroError[] = [...unknown];
    for (const result of results) {
      const line = Number(result.key);
      if (result.dsl === null) failed.push({ line, col: 1, message: result.error ?? 'the macro produced nothing' });
      else expansions.set(line, result.dsl);
    }

    return { ...applyMacros(src, expansions), errors: [...errors, ...failed] };
  }

  async runCommand(plugin: string, command: string): Promise<CommandAction> {
    const reply = await this.ask<Extract<SandboxResponse, { type: 'commandDone' }>>(
      id => ({ type: 'command', id, plugin, command }),
      COMMAND_TIMEOUT,
      { type: 'commandDone', id: 0, action: { kind: 'status', text: 'The plugin took too long and was stopped' }, error: null },
    );
    if (reply.error) return { kind: 'status', text: reply.error };
    return reply.action;
  }

  dispose(): void {
    this.reset();
  }
}

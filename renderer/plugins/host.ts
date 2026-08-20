import Sandbox from './sandbox.worker?worker';
import type {
  CommandAction, CommandInfo, HostCall, LoadedPlugin, LoadRequest, MacroCall, MacroResult,
  SandboxRequest, SandboxResponse, ViewEvent,
} from './protocol';
import { applyMacros, findMacros } from '../../src/plugin/macro';
import type { Expanded, MacroError } from '../../src/plugin/macro';
import type { InstalledPlugin } from '../../src/plugin/manifest';
import { emptyContributions, parseContributions, resolveKeys } from '../../src/plugin/contributions';
import type { Contributions, MenuArea, MenuItem, StatusItem, View } from '../../src/plugin/contributions';

const EXPAND_TIMEOUT = 1500;
const COMMAND_TIMEOUT = 3000;

interface Pending {
  plugin: string;
  resolve: (value: never) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface ExpandResult extends Expanded {
  errors: MacroError[];
}

export interface HostServices {
  notify(kind: 'info' | 'warning' | 'error', text: string): void;
  status(text: string): void;
  editorText(): string;
  editorSelection(): string;
  editorInsert(text: string): void;
  editorReplace(text: string): void;
  editorSetText(text: string): void;
  workspace(): string | null;
  runApp(command: string): Promise<void>;
}

export const APP_COMMANDS = [
  'format', 'compile', 'save', 'export.png', 'export.svg', 'export.link',
  'view.dsl', 'view.enhanced', 'panel.optimizer', 'panel.problems',
] as const;

export class PluginHost {
  private workers = new Map<string, Worker>();
  private requests = new Map<string, LoadRequest>();
  private installed: InstalledPlugin[] = [];
  private loaded = new Map<string, LoadedPlugin>();
  private macroOwner = new Map<string, string>();
  private contributed = new Map<string, Contributions>();
  private extraCommands = new Map<string, CommandInfo[]>();
  private keyOwners = new Map<string, { plugin: string; command: string }>();
  private keyClashes = new Map<string, string[]>();
  private pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(
    private readonly onChange: () => void,
    private readonly services: HostServices,
  ) {}

  list(): InstalledPlugin[] {
    return this.installed;
  }

  loadError(id: string): string | null {
    const clash = this.keyClashes.get(id);
    if (clash?.length) return `another plugin already holds ${clash.join(', ')}`;
    return this.loaded.get(id)?.error ?? null;
  }

  enabled(): InstalledPlugin[] {
    return this.installed.filter(p => p.enabled);
  }

  ids(): string[] {
    return this.enabled().map(p => p.manifest.id);
  }

  prelude(): string {
    return this.enabled()
      .map(p => p.lib)
      .filter((lib): lib is string => !!lib)
      .join('\n');
  }

  commands(): CommandInfo[] {
    return this.enabled().flatMap(p =>
      this.extraCommands.get(p.manifest.id) ?? this.loaded.get(p.manifest.id)?.commands ?? []);
  }

  views(): { plugin: string; view: View }[] {
    return this.enabled().flatMap(p =>
      (this.contributed.get(p.manifest.id)?.views ?? []).map(view => ({ plugin: p.manifest.id, view })));
  }

  statusItems(): { plugin: string; item: StatusItem }[] {
    return this.enabled().flatMap(p =>
      (this.contributed.get(p.manifest.id)?.status ?? []).map(item => ({ plugin: p.manifest.id, item })));
  }

  menuItems(area: MenuArea): { plugin: string; item: MenuItem }[] {
    return this.enabled().flatMap(p =>
      (this.contributed.get(p.manifest.id)?.menus ?? [])
        .filter(item => item.area === area)
        .map(item => ({ plugin: p.manifest.id, item })));
  }

  keyOwner(combo: string): { plugin: string; command: string } | null {
    return this.keyOwners.get(combo) ?? null;
  }

  async refresh(): Promise<void> {
    this.installed = (await window.electronAPI?.pluginList()) ?? [];
    await this.reload();
    this.onChange();
  }

  async reloadWorkspace(): Promise<void> {
    await this.reload();
    this.onChange();
  }

  private reset(): void {
    for (const p of this.pending.values()) clearTimeout(p.timer);
    this.pending.clear();
    for (const worker of this.workers.values()) worker.terminate();
    this.workers.clear();
    this.requests.clear();
  }

  private async reload(): Promise<void> {
    this.reset();
    this.loaded.clear();
    this.macroOwner.clear();
    this.contributed.clear();
    this.extraCommands.clear();
    this.keyOwners.clear();
    this.keyClashes.clear();

    const withCode = this.enabled().filter(p => p.main);
    if (withCode.length === 0) return;

    const workspace = this.services.workspace();
    const requests = await Promise.all(withCode.map(async p => {
      const id = p.manifest.id;
      const state = await window.electronAPI?.pluginState({ id, workspace });
      return {
        id,
        main: p.main!,
        globalState: state?.global ?? {},
        workspaceState: state?.workspace ?? {},
        storagePath: state?.storagePath ?? null,
        globalStoragePath: state?.globalStoragePath ?? null,
      };
    }));

    const loaded = await Promise.all(requests.map(request => this.spawn(request)));

    for (const plugin of loaded) {
      this.loaded.set(plugin.id, plugin);
      for (const macro of plugin.macros) {
        if (!this.macroOwner.has(macro)) this.macroOwner.set(macro, plugin.id);
      }
    }
  }

  private spawn(request: LoadRequest): Promise<LoadedPlugin> {
    this.requests.set(request.id, request);
    this.workers.get(request.id)?.terminate();

    const worker = new Sandbox();
    this.workers.set(request.id, worker);
    worker.addEventListener('message', e =>
      this.onMessage(request.id, e as MessageEvent<SandboxResponse>));

    return new Promise<LoadedPlugin>(resolve => {
      const done = (event: MessageEvent<SandboxResponse>) => {
        if (event.data.type !== 'loaded') return;
        worker.removeEventListener('message', done);
        resolve(event.data.plugins[0] ?? { id: request.id, macros: [], commands: [], error: null });
      };
      worker.addEventListener('message', done);
      worker.postMessage({ type: 'load', plugins: [request] } satisfies SandboxRequest);
    });
  }

  private async restart(id: string): Promise<void> {
    const request = this.requests.get(id);
    if (!request) return;
    for (const [callId, held] of this.pending) {
      if (held.plugin !== id) continue;
      clearTimeout(held.timer);
      this.pending.delete(callId);
    }
    const plugin = await this.spawn(request);
    this.loaded.set(id, plugin);
  }

  private send(plugin: string, msg: SandboxRequest): void {
    this.workers.get(plugin)?.postMessage(msg);
  }

  private onMessage(owner: string, event: MessageEvent<SandboxResponse>): void {
    const msg = event.data;
    if (msg.type === 'loaded') return;

    if (msg.type === 'contributes') {
      this.contributed.set(owner, parseContributions(owner, msg.contributions));
      this.recount();
      this.onChange();
      return;
    }

    if (msg.type === 'commands') {
      this.extraCommands.set(owner, msg.commands.map(c => ({ ...c, plugin: owner })));
      this.onChange();
      return;
    }

    if (msg.type === 'host') {
      void this.serve(owner, msg);
      return;
    }

    const waiting = this.pending.get(msg.id);
    if (!waiting) return;
    clearTimeout(waiting.timer);
    this.pending.delete(msg.id);
    waiting.resolve(msg as never);
  }

  private recount(): void {
    const order = this.enabled()
      .map(p => this.contributed.get(p.manifest.id) ?? emptyContributions(p.manifest.id));
    const { owned, clashes } = resolveKeys(order);
    this.keyOwners = owned;
    this.keyClashes = clashes;
  }

  private async serve(owner: string, msg: Extract<SandboxResponse, { type: 'host' }>): Promise<void> {
    const reply = (ok: boolean, value?: unknown, error?: string) =>
      this.send(owner, { type: 'hostReply', id: msg.id, ok, value, error });

    try {
      reply(true, await this.call(owner, msg.call, msg.args));
    } catch (err) {
      reply(false, undefined, err instanceof Error ? err.message : String(err));
    }
  }

  private async call(plugin: string, call: HostCall, args: unknown[]): Promise<unknown> {
    const text = (i: number): string => (typeof args[i] === 'string' ? (args[i] as string) : '');

    switch (call) {
      case 'notify': {
        const kind = text(0);
        this.services.notify(kind === 'warning' || kind === 'error' ? kind : 'info', text(1));
        return null;
      }
      case 'status':
        this.services.status(text(0));
        return null;

      case 'editor.text':
        return this.services.editorText();
      case 'editor.selection':
        return this.services.editorSelection();
      case 'editor.insert':
        this.services.editorInsert(text(0));
        return null;
      case 'editor.replace':
        this.services.editorReplace(text(0));
        return null;
      case 'editor.setText':
        this.services.editorSetText(text(0));
        return null;

      case 'app.run': {
        const command = text(0);
        if (!APP_COMMANDS.includes(command as (typeof APP_COMMANDS)[number])) {
          throw new Error(`'${command}' is not an app command a plugin may run`);
        }
        await this.services.runApp(command);
        return null;
      }

      case 'state.update':
        return window.electronAPI?.pluginStateUpdate({
          id: plugin,
          scope: text(0) === 'global' ? 'global' : 'workspace',
          workspace: this.services.workspace(),
          key: text(1),
          value: args[2] ?? null,
        }) ?? null;

      case 'state.sync':
        return window.electronAPI?.pluginStateSync({
          id: plugin,
          keys: Array.isArray(args[0]) ? (args[0] as unknown[]).filter((k): k is string => typeof k === 'string') : [],
        }) ?? null;

      case 'secrets.get':
        return (await window.electronAPI?.pluginSecret({ id: plugin, key: text(0) })) ?? null;
      case 'secrets.store':
        return (await window.electronAPI?.pluginSecretStore({ id: plugin, key: text(0), value: text(1) })) ?? false;
      case 'secrets.delete':
        return (await window.electronAPI?.pluginSecretDelete({ id: plugin, key: text(0) })) ?? false;

      case 'state.get':
      case 'state.keys':
      case 'storage.path':
        return null;
    }
  }

  private ask<T extends SandboxResponse>(
    plugin: string, msg: (id: number) => SandboxRequest, ms: number, onTimeout: T,
  ): Promise<T> {
    if (!this.workers.has(plugin)) return Promise.resolve(onTimeout);
    const id = this.nextId++;
    return new Promise<T>(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        void this.restart(plugin);
        resolve(onTimeout);
      }, ms);
      this.pending.set(id, { plugin, resolve: resolve as (value: never) => void, timer });
      this.send(plugin, msg(id));
    });
  }

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

    const byPlugin = new Map<string, MacroCall[]>();
    for (const call of calls) {
      const held = byPlugin.get(call.plugin);
      if (held) held.push(call);
      else byPlugin.set(call.plugin, [call]);
    }

    const replies = await Promise.all([...byPlugin].map(([plugin, mine]) =>
      this.ask<Extract<SandboxResponse, { type: 'expanded' }>>(
        plugin,
        id => ({ type: 'expand', id, calls: mine }),
        EXPAND_TIMEOUT,
        {
          type: 'expanded',
          id: 0,
          results: mine.map(c => ({ key: c.key, dsl: null, error: 'the plugin took too long and was stopped' })),
        },
      )));

    const results: MacroResult[] = replies.flatMap(reply => reply.results);

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
      plugin,
      id => ({ type: 'command', id, plugin, command }),
      COMMAND_TIMEOUT,
      { type: 'commandDone', id: 0, action: { kind: 'status', text: 'The plugin took too long and was stopped' }, error: null },
    );
    if (reply.error) return { kind: 'status', text: reply.error };
    return reply.action;
  }

  sendEvent(plugin: string, event: ViewEvent): void {
    this.send(plugin, { type: 'event', plugin, event });
  }

  dispose(): void {
    this.reset();
  }
}

import type {
  CommandAction, CommandInfo, HostCall, LoadedPlugin, MacroResult, SandboxRequest, SandboxResponse,
  ViewEvent,
} from './protocol';

const post = self.postMessage.bind(self);

const STRIPPED = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts',
  'indexedDB', 'caches', 'Worker', 'SharedWorker', 'BroadcastChannel',
  'Notification', 'navigator', 'location', 'postMessage', 'close',
];

function strip(): void {
  const scope = self as unknown as Record<string, unknown>;
  for (const name of STRIPPED) {
    try {
      Object.defineProperty(scope, name, { value: undefined, configurable: false, writable: false });
    } catch {
    }
  }
}

type MacroFn = (...args: (number | string)[]) => unknown;
type CommandFn = () => unknown;
type EventFn = (widget: string, value: string | number | boolean | null) => unknown;

interface Registered {
  macros: Map<string, MacroFn>;
  commands: Map<string, { info: CommandInfo; run: CommandFn }>;
  views: Map<string, { view: unknown; onEvent: EventFn | null }>;
  status: Map<string, unknown>;
  keys: Map<string, string>;
  menus: unknown[];
  global: Record<string, unknown>;
  workspace: Record<string, unknown>;
  sync: string[];
  storagePath: string | null;
  globalStoragePath: string | null;
}

const loaded = new Map<string, Registered>();

const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let nextCall = 1;

function hostCall(plugin: string, call: HostCall, args: unknown[]): Promise<unknown> {
  const id = nextCall++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    post({ type: 'host', id, plugin, call, args } satisfies SandboxResponse);
  });
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function need(value: unknown, what: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${what} must be a string`);
  return value;
}

function needFn(value: unknown, what: string): void {
  if (typeof value !== 'function') throw new Error(`${what} must be a function`);
}

function sendContributions(plugin: string, reg: Registered): void {
  post({
    type: 'contributes',
    plugin,
    contributions: {
      views: [...reg.views.values()].map(v => v.view),
      status: [...reg.status.values()],
      keys: [...reg.keys.entries()].map(([key, command]) => ({ key, command })),
      menus: reg.menus,
    },
  } satisfies SandboxResponse);
}

function sendCommands(plugin: string, reg: Registered): void {
  post({
    type: 'commands',
    plugin,
    commands: [...reg.commands.values()].map(c => c.info),
  } satisfies SandboxResponse);
}

function memento(plugin: string, reg: Registered, scope: 'global' | 'workspace') {
  const store = () => (scope === 'global' ? reg.global : reg.workspace);
  return {
    get(key: string, fallback?: unknown): unknown {
      const value = store()[need(key, 'key')];
      return value === undefined ? fallback : value;
    },
    keys(): string[] {
      return Object.keys(store());
    },
    async update(key: string, value: unknown): Promise<void> {
      need(key, 'key');
      const clean = value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as unknown);
      if (clean === undefined) delete store()[key];
      else store()[key] = clean;
      await hostCall(plugin, 'state.update', [scope, key, clean ?? null]);
    },
    ...(scope === 'global'
      ? {
        setKeysForSync: (keys: unknown): void => {
          if (!Array.isArray(keys)) throw new Error('setKeysForSync takes an array of keys');
          reg.sync = keys.filter((k): k is string => typeof k === 'string');
          void hostCall(plugin, 'state.sync', [reg.sync]);
        },
      }
      : {}),
  };
}

function api(plugin: string, reg: Registered) {
  const notify = (kind: 'info' | 'warning' | 'error') => (text: unknown): Promise<unknown> =>
    hostCall(plugin, 'notify', [kind, need(text, 'the message')]);

  const commands = {
    registerCommand(id: string, label: string, fn: CommandFn): void {
      need(id, 'a command id');
      need(label, 'a command label');
      needFn(fn, 'a command handler');
      reg.commands.set(id, { info: { plugin, id, label }, run: fn });
      sendCommands(plugin, reg);
    },
    getCommands(): string[] {
      return [...reg.commands.keys()];
    },
  };

  const window = {
    showInformationMessage: notify('info'),
    showWarningMessage: notify('warning'),
    showErrorMessage: notify('error'),
    setStatusMessage: (text: unknown): Promise<unknown> =>
      hostCall(plugin, 'status', [need(text, 'the status text')]),

    registerView(view: { id?: unknown; title?: unknown }, onEvent?: EventFn): void {
      const id = need(view?.id, 'a view id');
      need(view?.title, 'a view title');
      if (onEvent !== undefined) needFn(onEvent, 'the view event handler');
      reg.views.set(id, { view, onEvent: onEvent ?? null });
      sendContributions(plugin, reg);
    },
    updateView(id: string, widgets: unknown): void {
      const held = reg.views.get(need(id, 'a view id'));
      if (!held) throw new Error(`no view '${id}'`);
      (held.view as { widgets: unknown }).widgets = widgets;
      sendContributions(plugin, reg);
    },
    removeView(id: string): void {
      reg.views.delete(need(id, 'a view id'));
      sendContributions(plugin, reg);
    },

    registerStatusBarItem(item: { id?: unknown }): void {
      reg.status.set(need(item?.id, 'a status item id'), item);
      sendContributions(plugin, reg);
    },
    removeStatusBarItem(id: string): void {
      reg.status.delete(need(id, 'a status item id'));
      sendContributions(plugin, reg);
    },
  };

  const editor = {
    getText: (): Promise<unknown> => hostCall(plugin, 'editor.text', []),
    getSelection: (): Promise<unknown> => hostCall(plugin, 'editor.selection', []),
    insert: (text: unknown): Promise<unknown> => hostCall(plugin, 'editor.insert', [need(text, 'the text')]),
    replace: (text: unknown): Promise<unknown> => hostCall(plugin, 'editor.replace', [need(text, 'the text')]),
    setText: (text: unknown): Promise<unknown> => hostCall(plugin, 'editor.setText', [need(text, 'the text')]),
  };

  const secrets = {
    get: (key: unknown): Promise<unknown> => hostCall(plugin, 'secrets.get', [need(key, 'a secret key')]),
    store: (key: unknown, value: unknown): Promise<unknown> =>
      hostCall(plugin, 'secrets.store', [need(key, 'a secret key'), need(value, 'the secret')]),
    delete: (key: unknown): Promise<unknown> => hostCall(plugin, 'secrets.delete', [need(key, 'a secret key')]),
  };

  return {
    macro(name: string, fn: MacroFn): void {
      need(name, 'a macro name');
      needFn(fn, 'a macro body');
      if (!/^[a-z][a-z0-9_]{0,39}$/i.test(name)) throw new Error(`'${name}' is not a usable macro name`);
      reg.macros.set(name, fn);
    },
    command(id: string, label: string, fn: CommandFn): void {
      commands.registerCommand(id, label, fn);
    },

    commands,
    window,
    editor,
    secrets,
    workspaceState: memento(plugin, reg, 'workspace'),
    globalState: memento(plugin, reg, 'global'),

    keybindings: {
      register(key: unknown, command: unknown): void {
        reg.keys.set(need(key, 'a key combo'), need(command, 'a command id'));
        sendContributions(plugin, reg);
      },
    },
    menus: {
      register(area: unknown, command: unknown, label: unknown): void {
        reg.menus.push({ area: need(area, 'a menu area'), command: need(command, 'a command id'), label: need(label, 'a label') });
        sendContributions(plugin, reg);
      },
    },
    app: {
      run: (command: unknown): Promise<unknown> => hostCall(plugin, 'app.run', [need(command, 'a command id')]),
    },

    get storageUri(): string | null { return reg.storagePath; },
    get globalStorageUri(): string | null { return reg.globalStoragePath; },
    get pluginId(): string { return plugin; },
  };
}

type LoadRequest = Extract<SandboxRequest, { type: 'load' }>['plugins'][number];

function blank(): Registered {
  return {
    macros: new Map(), commands: new Map(), views: new Map(), status: new Map(),
    keys: new Map(), menus: [], global: {}, workspace: {}, sync: [],
    storagePath: null, globalStoragePath: null,
  };
}

function load(plugins: LoadRequest[]): void {
  loaded.clear();
  const result: LoadedPlugin[] = [];

  for (const entry of plugins) {
    const reg = blank();
    reg.global = { ...entry.globalState };
    reg.workspace = { ...entry.workspaceState };
    reg.storagePath = entry.storagePath ?? null;
    reg.globalStoragePath = entry.globalStoragePath ?? null;

    let error: string | null = null;
    try {
      const factory = new Function('dsmx', `'use strict';\n${entry.main}\n`);
      factory(api(entry.id, reg));
      loaded.set(entry.id, reg);
    } catch (err) {
      error = describe(err);
    }
    result.push({
      id: entry.id,
      macros: [...reg.macros.keys()],
      commands: [...reg.commands.values()].map(c => c.info),
      error,
    });
    if (!error) sendContributions(entry.id, reg);
  }

  post({ type: 'loaded', plugins: result } satisfies SandboxResponse);
}

function expandOne(plugin: string, macro: string, args: (number | string)[]): string {
  const reg = loaded.get(plugin);
  if (!reg) throw new Error(`plugin '${plugin}' is not loaded`);
  const fn = reg.macros.get(macro);
  if (!fn) throw new Error(`plugin '${plugin}' has no macro '${macro}'`);
  const out = fn(...args);
  if (typeof out !== 'string') throw new Error(`macro '${macro}' returned ${typeof out}, not dsl text`);
  return out;
}

function toAction(raw: unknown): CommandAction {
  if (!raw || typeof raw !== 'object') return { kind: 'none' };
  const r = raw as Record<string, unknown>;
  for (const kind of ['insert', 'replace', 'status'] as const) {
    if (typeof r[kind] === 'string') return { kind, text: r[kind] as string };
  }
  return { kind: 'none' };
}

async function runCommand(msg: Extract<SandboxRequest, { type: 'command' }>): Promise<void> {
  try {
    const entry = loaded.get(msg.plugin)?.commands.get(msg.command);
    if (!entry) throw new Error(`no command '${msg.command}'`);
    // a command may now wait on the app, so its result is awaited either way
    const out: unknown = await entry.run();
    post({ type: 'commandDone', id: msg.id, action: toAction(out), error: null } satisfies SandboxResponse);
  } catch (err) {
    post({ type: 'commandDone', id: msg.id, action: { kind: 'none' }, error: describe(err) } satisfies SandboxResponse);
  }
}

function dispatchEvent(plugin: string, event: ViewEvent): void {
  const handler = loaded.get(plugin)?.views.get(event.view)?.onEvent;
  if (!handler) return;
  try {
    void handler(event.widget, event.value);
  } catch (err) {
    void hostCall(plugin, 'notify', ['error', describe(err)]);
  }
}

self.addEventListener('message', (event: MessageEvent<SandboxRequest>) => {
  const msg = event.data;

  if (msg.type === 'load') {
    load(msg.plugins);
    return;
  }

  if (msg.type === 'hostReply') {
    const held = waiting.get(msg.id);
    if (!held) return;
    waiting.delete(msg.id);
    if (msg.ok) held.resolve(msg.value);
    else held.reject(new Error(msg.error ?? 'the app refused'));
    return;
  }

  if (msg.type === 'event') {
    dispatchEvent(msg.plugin, msg.event);
    return;
  }

  if (msg.type === 'expand') {
    const results: MacroResult[] = msg.calls.map(call => {
      try {
        return { key: call.key, dsl: expandOne(call.plugin, call.macro, call.args), error: null };
      } catch (err) {
        return { key: call.key, dsl: null, error: describe(err) };
      }
    });
    post({ type: 'expanded', id: msg.id, results } satisfies SandboxResponse);
    return;
  }

  if (msg.type === 'command') void runCommand(msg);
});

strip();

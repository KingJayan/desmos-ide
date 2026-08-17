import type {
  CommandAction, CommandInfo, LoadedPlugin, MacroResult, SandboxRequest, SandboxResponse,
} from './protocol';

// a plugin is other people's code, so this worker gives up everything it does not need
// before the first plugin runs. what is left is arithmetic and string building: no
// network, no storage, no way to spawn anything and no route back to the page except
// the two functions captured here.
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
      // a non-configurable global stays. the ones that matter are all removable
    }
  }
}

type MacroFn = (...args: (number | string)[]) => unknown;
type CommandFn = () => unknown;

interface Registered {
  macros: Map<string, MacroFn>;
  commands: Map<string, { info: CommandInfo; run: CommandFn }>;
}

const loaded = new Map<string, Registered>();

function api(pluginId: string, reg: Registered) {
  return {
    macro(name: string, fn: MacroFn): void {
      if (typeof name !== 'string' || typeof fn !== 'function') throw new Error('macro(name, fn) needs a name and a function');
      if (!/^[a-z][a-z0-9_]{0,39}$/i.test(name)) throw new Error(`'${name}' is not a usable macro name`);
      reg.macros.set(name, fn);
    },
    command(id: string, label: string, fn: CommandFn): void {
      if (typeof id !== 'string' || typeof label !== 'string' || typeof fn !== 'function') {
        throw new Error('command(id, label, fn) needs an id, a label and a function');
      }
      reg.commands.set(id, { info: { plugin: pluginId, id, label }, run: fn });
    },
  };
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function load(plugins: { id: string; main: string }[]): void {
  loaded.clear();
  const result: LoadedPlugin[] = [];

  for (const { id, main } of plugins) {
    const reg: Registered = { macros: new Map(), commands: new Map() };
    let error: string | null = null;
    try {
      // 'use strict' keeps a plugin from writing accidental globals, and the only
      // name in scope is the api it is handed
      const factory = new Function('dsmx', `'use strict';\n${main}\n`);
      factory(api(id, reg));
      loaded.set(id, reg);
    } catch (err) {
      error = describe(err);
    }
    result.push({
      id,
      macros: [...reg.macros.keys()],
      commands: [...reg.commands.values()].map(c => c.info),
      error,
    });
  }

  post({ type: 'loaded', plugins: result } satisfies SandboxResponse);
}

/** a macro must return dsl text. anything else is the plugin's bug, not the file's */
function expandOne(plugin: string, macro: string, args: (number | string)[]): MacroResult['dsl'] {
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

self.addEventListener('message', (event: MessageEvent<SandboxRequest>) => {
  const msg = event.data;

  if (msg.type === 'load') {
    load(msg.plugins);
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

  if (msg.type === 'command') {
    try {
      const entry = loaded.get(msg.plugin)?.commands.get(msg.command);
      if (!entry) throw new Error(`no command '${msg.command}'`);
      post({ type: 'commandDone', id: msg.id, action: toAction(entry.run()), error: null } satisfies SandboxResponse);
    } catch (err) {
      post({ type: 'commandDone', id: msg.id, action: { kind: 'none' }, error: describe(err) } satisfies SandboxResponse);
    }
  }
});

strip();

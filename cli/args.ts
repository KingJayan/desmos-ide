export type Command = 'run' | 'build' | 'fmt' | 'fix' | 'help' | 'version';

export interface Options {
  command: Command;
  file: string | null;
  out: string | null;
  port: number;
  host: string;
  open: boolean;
  watch: boolean;
  check: boolean;
  theme: 'dark' | 'light';
}

export class ArgError extends Error {}

const DEFAULTS: Options = {
  command: 'help',
  file: null,
  out: null,
  port: 7717,
  host: '127.0.0.1',
  open: true,
  watch: true,
  check: false,
  theme: 'dark',
};

const COMMANDS = new Set<Command>(['run', 'build', 'fmt', 'fix', 'help', 'version']);

function isCommand(word: string): word is Command {
  return COMMANDS.has(word as Command);
}

function value(argv: string[], i: number, flag: string): string {
  const next = argv[i + 1];
  // a lone '-' is stdout, so only a longer dash word is another flag
  if (next === undefined || (next.startsWith('-') && next.length > 1)) throw new ArgError(`${flag} needs a value`);
  return next;
}

export function parseArgs(argv: string[]): Options {
  const opts: Options = { ...DEFAULTS };
  let sawCommand = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '-h': case '--help':    opts.command = 'help'; return opts;
      case '-v': case '--version': opts.command = 'version'; return opts;
      case '--no-open':  opts.open = false; continue;
      case '--no-watch': opts.watch = false; continue;
      case '--check':    opts.check = true; continue;
      case '-o': case '--out': opts.out = value(argv, i, arg); i++; continue;
      case '--host': opts.host = value(argv, i, arg); i++; continue;
      case '--port': {
        const port = Number(value(argv, i, arg));
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ArgError('--port must be a port number');
        opts.port = port;
        i++;
        continue;
      }
      case '--theme': {
        const theme = value(argv, i, arg);
        if (theme !== 'dark' && theme !== 'light') throw new ArgError('--theme must be dark or light');
        opts.theme = theme;
        i++;
        continue;
      }
    }

    if (arg.startsWith('-')) throw new ArgError(`unknown option ${arg}`);

    if (!sawCommand && isCommand(arg)) {
      opts.command = arg;
      sawCommand = true;
      continue;
    }
    if (opts.file !== null) throw new ArgError('one file at a time');
    // a bare path with no command in front of it means run
    if (!sawCommand) { opts.command = 'run'; sawCommand = true; }
    opts.file = arg;
  }

  if (opts.command !== 'help' && opts.command !== 'version' && opts.file === null) {
    throw new ArgError(`${opts.command} needs a .dsmx file`);
  }
  return opts;
}

export const HELP = `dsmx — run a .dsmx file in a graph window

usage
  dsmx run <file.dsmx>      compile, open a graph in the browser, reload on save
  dsmx build <file.dsmx>    write the desmos state as json
  dsmx fmt <file.dsmx>      format the file in place
  dsmx fix <file.dsmx>      rewrite the file in the current grammar

options
  -o, --out <path>   where build writes its json, or - for stdout
      --port <n>     port for run (default 7717)
      --host <addr>  address to bind (default 127.0.0.1)
      --theme <t>    dark or light (default dark)
      --no-open      serve without opening a browser
      --no-watch     do not reload when the file changes
      --check        fmt reports rather than writes, and exits 1 if it would change
  -h, --help         this text
  -v, --version      print the version

examples
  dsmx orbit.dsmx
  dsmx run rose.dsmx --theme light --port 8080
  dsmx build helix-3d.dsmx -o helix.json
`;

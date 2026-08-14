import { Utils } from 'electrobun/bun';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { basename, extname, join } from 'path';

const execFileAsync = promisify(execFile);

export type SaveDialogOptions = {
  defaultName: string;
  extension: string;
  prompt: string;
};

export type OpenDialogOptions = {
  extensions: string[];
};

function asString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function ensureExtension(path: string, extension: string): string {
  if (!extension) return path;
  return extname(path).toLowerCase() === `.${extension.toLowerCase()}`
    ? path
    : `${path}.${extension}`;
}


// use nssavepanel cuz electrobun doesnt have it
export async function showSaveDialog(opts: SaveDialogOptions): Promise<string | null> {
  if (process.platform !== 'darwin') return saveDialogFallback(opts);

  const script = [
    `set chosen to choose file name with prompt ${asString(opts.prompt)} default name ${asString(opts.defaultName)}`,
    'POSIX path of chosen',
  ].join('\n');

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], {
      maxBuffer: 256 * 1024,
    });
    const path = stdout.trim();
    return path ? ensureExtension(path, opts.extension) : null;
  } catch (err) {

    if (String(err).includes('-128')) return null;
    throw err;
  }
}

async function saveDialogFallback(opts: SaveDialogOptions): Promise<string | null> {
  const picked = await Utils.openFileDialog({
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false,
  });
  const dir = picked.filter(Boolean)[0];
  if (!dir) return null;
  return join(dir, ensureExtension(basename(opts.defaultName), opts.extension));
}

export async function showOpenDialog(opts: OpenDialogOptions): Promise<string | null> {
  const picked = await Utils.openFileDialog({
    canChooseFiles: true,
    canChooseDirectory: false,
    allowsMultipleSelection: false,
    allowedFileTypes: opts.extensions.length ? opts.extensions.join(',') : '*',
  });
  return picked.filter(Boolean)[0] ?? null;
}

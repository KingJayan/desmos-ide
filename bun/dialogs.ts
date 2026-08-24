import { Utils } from 'electrobun/bun';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { basename, extname, join } from 'path';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);

function nativeBinary(name: string): string {
  const binary = join(__dirname, 'native', name);
  if (!existsSync(binary)) {
    throw new Error(`native helper "${name}" is missing; run "bun run build:native"`);
  }
  return binary;
}

export type SaveDialogOptions = {
  defaultName: string;
  extension: string;
  prompt: string;
};

export type OpenDialogOptions = {
  extensions: string[];
};

function ensureExtension(path: string, extension: string): string {
  if (!extension) return path;
  return extname(path).toLowerCase() === `.${extension.toLowerCase()}`
    ? path
    : `${path}.${extension}`;
}


// use nssavepanel cuz electrobun doesnt have it
export async function showSaveDialog(opts: SaveDialogOptions): Promise<string | null> {
  if (process.platform !== 'darwin') return saveDialogFallback(opts);

  let binary: string;
  try {
    binary = nativeBinary('savepanel');
  } catch {
    return saveDialogFallback(opts);
  }

  try {
    const { stdout } = await execFileAsync(binary, [opts.prompt, opts.defaultName], {
      maxBuffer: 256 * 1024,
    });
    const path = stdout.trim();
    return path ? ensureExtension(path, opts.extension) : null;
  } catch (err) {
    if ((err as { code?: number }).code === 1) return null;
    throw err;
  }
}

export async function showConfirm(message: string): Promise<boolean> {
  const { response } = await Utils.showMessageBox({
    type: 'question',
    title: 'desmos-ide',
    message,
    buttons: ['OK', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });
  return response === 0;
}

export async function showPrompt(message: string, defaultValue: string): Promise<string | null> {
  // no other desktop has a helper for this, and the view answers with its own prompt
  if (process.platform !== 'darwin') throw new Error('no native prompt on this desktop');

  const binary = nativeBinary('prompt');
  try {
    const { stdout } = await execFileAsync(binary, [message, defaultValue], { maxBuffer: 64 * 1024 });
    return stdout.replace(/\n$/, '');
  } catch (err) {
    if ((err as { code?: number }).code === 1) return null;
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

// lets search reach a folder before any file is open, which is the state a fresh install is in
export async function showFolderDialog(): Promise<string | null> {
  const picked = await Utils.openFileDialog({
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false,
  });
  return picked.filter(Boolean)[0] ?? null;
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

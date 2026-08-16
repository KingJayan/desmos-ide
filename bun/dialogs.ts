import { Utils } from 'electrobun/bun';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { basename, extname, join } from 'path';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);

/**
 * scripts/build-native.ts compiles these before the bundle
 */
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

// use nsalert cuz browser confirm() doesnt look native in a webview
// throws on non-darwin so the caller can fall back to window.confirm
export async function showConfirm(message: string): Promise<boolean> {
  if (process.platform !== 'darwin') throw new Error('native confirm is macOS-only');

  const binary = nativeBinary('confirm');
  try {
    await execFileAsync(binary, [message], { maxBuffer: 64 * 1024 });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 1) return false;
    throw err;
  }
}

export async function showPrompt(message: string, defaultValue: string): Promise<string | null> {
  if (process.platform !== 'darwin') throw new Error('native prompt is macOS-only');

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

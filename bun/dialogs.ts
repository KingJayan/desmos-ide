import { Utils } from 'electrobun/bun';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { basename, extname, join, dirname } from 'path';
import { existsSync, statSync, mkdirSync } from 'fs';

const execFileAsync = promisify(execFile);

async function ensureNativeBinary(name: string): Promise<string> {
  const source = join(__dirname, 'native', `${name}.swift`);
  const binary = join(__dirname, '..', 'build', 'native', name);
  const stale = !existsSync(binary) || statSync(binary).mtimeMs < statSync(source).mtimeMs;
  if (stale) {
    mkdirSync(dirname(binary), { recursive: true });
    await execFileAsync('swiftc', ['-O', source, '-o', binary]);
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

  const binary = await ensureNativeBinary('savepanel');
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

  const binary = await ensureNativeBinary('confirm');
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

  const binary = await ensureNativeBinary('prompt');
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

export async function showOpenDialog(opts: OpenDialogOptions): Promise<string | null> {
  const picked = await Utils.openFileDialog({
    canChooseFiles: true,
    canChooseDirectory: false,
    allowsMultipleSelection: false,
    allowedFileTypes: opts.extensions.length ? opts.extensions.join(',') : '*',
  });
  return picked.filter(Boolean)[0] ?? null;
}

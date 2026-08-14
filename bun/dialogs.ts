import { Utils } from 'electrobun/bun';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { basename, extname, join, dirname } from 'path';
import { existsSync, statSync, mkdirSync } from 'fs';

const execFileAsync = promisify(execFile);

const savePanelSource = join(__dirname, 'native', 'savepanel.swift');
const savePanelBinary = join(__dirname, '..', 'build', 'native', 'savepanel');

async function ensureSavePanelBinary(): Promise<string> {
  const stale =
    !existsSync(savePanelBinary) ||
    statSync(savePanelBinary).mtimeMs < statSync(savePanelSource).mtimeMs;
  if (stale) {
    mkdirSync(dirname(savePanelBinary), { recursive: true });
    await execFileAsync('swiftc', ['-O', savePanelSource, '-o', savePanelBinary]);
  }
  return savePanelBinary;
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

  const binary = await ensureSavePanelBinary();
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

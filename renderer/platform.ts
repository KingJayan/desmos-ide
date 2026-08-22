import { DEFAULT_PLATFORM, isPlatformInfo, platformFromAgent } from '../src/shared/platform';
import type { PlatformInfo } from '../src/shared/rpc-schema';

const KEY = 'dsmx.platform';

let current: PlatformInfo = DEFAULT_PLATFORM;

export function platform(): PlatformInfo {
  return current;
}

export function isMac(): boolean {
  return current.os === 'macos';
}

export function setPlatform(next: PlatformInfo): void {
  current = next;
}

function stored(): PlatformInfo | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return isPlatformInfo(raw) ? raw : null;
  } catch {
    return null;
  }
}

function paint(): void {
  const root = document.documentElement;
  root.dataset['os'] = current.os;
  root.dataset['arch'] = current.arch;
}

export function initPlatform(): void {
  current = stored() ?? platformFromAgent(navigator.userAgent);
  paint();
}

export async function refreshPlatform(): Promise<boolean> {
  const info = await window.electronAPI?.platform();
  if (!info) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(info));
  } catch {
  }
  if (info.os === current.os && info.arch === current.arch) return false;
  current = info;
  paint();
  return true;
}

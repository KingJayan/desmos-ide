
import type { Arch, OS, PlatformInfo } from './rpc-schema';

export const DEFAULT_PLATFORM: PlatformInfo = { os: 'macos', arch: 'arm64' };

export function platformOf(platform: string, arch: string): PlatformInfo {
  const os: OS = platform === 'darwin' ? 'macos' : platform === 'win32' ? 'win' : 'linux';
  const cpu: Arch = arch === 'arm64' || arch === 'aarch64' ? 'arm64' : 'x64';
  return { os, arch: cpu };
}

export function isPlatformInfo(raw: unknown): raw is PlatformInfo {
  const held = raw as PlatformInfo | null;
  return !!held
    && (held.os === 'macos' || held.os === 'linux' || held.os === 'win')
    && (held.arch === 'arm64' || held.arch === 'x64');
}

export function platformFromAgent(agent: string): PlatformInfo {
  const os: OS = /windows|win32/i.test(agent)
    ? 'win'
    : /mac os x|macintosh/i.test(agent)
      ? 'macos'
      : /linux|x11|cros/i.test(agent)
        ? 'linux'
        : DEFAULT_PLATFORM.os;
  const arch: Arch = /arm64|aarch64/i.test(agent) || os === 'macos' ? 'arm64' : 'x64';
  return { os, arch };
}

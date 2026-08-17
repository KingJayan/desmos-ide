import { spawn } from 'node:child_process';

/** the command that hands a url to whatever browser the desktop already uses */
export function openCommand(platform: string, url: string): string[] | null {
  switch (platform) {
    case 'darwin': return ['open', url];
    case 'linux':  return ['xdg-open', url];
    case 'win32':  return ['cmd', '/c', 'start', '', url];
    default:       return null;
  }
}

export function openBrowser(url: string): boolean {
  const cmd = openCommand(process.platform, url);
  if (!cmd) return false;
  try {
    const child = spawn(cmd[0], cmd.slice(1), { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// api keys and the copilot token

import { execFile } from 'child_process';

const SERVICE = 'desmos-ide';
const NOT_FOUND = 44;

export function secretsAvailable(): boolean {
  return process.platform === 'darwin';
}

type Run = { code: number; stdout: string };

function run(args: string[], stdin?: string): Promise<Run> {
  return new Promise(resolve => {
    const child = execFile('security', args, { maxBuffer: 256 * 1024 }, (err, stdout) => {
      const code = (err as { code?: number } | null)?.code ?? 0;
      resolve({ code: typeof code === 'number' ? code : 1, stdout });
    });
    if (stdin !== undefined) {
      child.stdin?.end(stdin);
    }
  });
}

export async function getSecret(account: string): Promise<string | null> {
  if (!secretsAvailable() || !account) return null;
  const { code, stdout } = await run(
    ['find-generic-password', '-s', SERVICE, '-a', account, '-w'],
  );
  if (code === NOT_FOUND || code !== 0) return null;
  return stdout.replace(/\n$/, '');
}

export async function setSecret(account: string, value: string): Promise<boolean> {
  if (!secretsAvailable() || !account) return false;
  if (!value) return deleteSecret(account);
  // the value goes over stdin
  const { code } = await run(
    ['add-generic-password', '-U', '-s', SERVICE, '-a', account, '-w'],
    `${value}\n${value}\n`,
  );
  return code === 0;
}

export async function deleteSecret(account: string): Promise<boolean> {
  if (!secretsAvailable() || !account) return false;
  const { code } = await run(['delete-generic-password', '-s', SERVICE, '-a', account]);
  return code === 0 || code === NOT_FOUND;
}

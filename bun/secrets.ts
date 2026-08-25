// api keys and the copilot token

import { execFile } from 'child_process';

const SERVICE = 'desmos-ide';
const NOT_FOUND = 44;

type Backend = 'keychain' | 'libsecret' | 'none';

let backend: Backend = process.platform === 'darwin' ? 'keychain' : 'none';

export function secretsAvailable(): boolean {
  return backend !== 'none';
}

// libsecret is not part of a minimal desktop, so the answer must be the real one
export async function probeSecrets(): Promise<void> {
  if (backend === 'keychain') return;
  const { code } = await run('secret-tool', ['--version']);
  backend = code === 0 ? 'libsecret' : 'none';
}

type Run = { code: number; stdout: string };

function run(command: string, args: string[], stdin?: string): Promise<Run> {
  return new Promise(resolve => {
    const child = execFile(command, args, { maxBuffer: 256 * 1024 }, (err, stdout) => {
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
  if (backend === 'libsecret') {
    const { code, stdout } = await run('secret-tool', ['lookup', 'service', SERVICE, 'account', account]);
    return code === 0 && stdout ? stdout.replace(/\n$/, '') : null;
  }
  const { code, stdout } = await run(
    'security',
    ['find-generic-password', '-s', SERVICE, '-a', account, '-w'],
  );
  if (code === NOT_FOUND || code !== 0) return null;
  return stdout.replace(/\n$/, '');
}

export async function setSecret(account: string, value: string): Promise<boolean> {
  if (!secretsAvailable() || !account) return false;
  if (!value) return deleteSecret(account);
  // the value goes over stdin
  if (backend === 'libsecret') {
    const { code } = await run(
      'secret-tool',
      ['store', '--label', `${SERVICE}: ${account}`, 'service', SERVICE, 'account', account],
      value,
    );
    return code === 0;
  }
  const { code } = await run(
    'security',
    ['add-generic-password', '-U', '-s', SERVICE, '-a', account, '-w'],
    `${value}\n${value}\n`,
  );
  return code === 0;
}

export async function deleteSecret(account: string): Promise<boolean> {
  if (!secretsAvailable() || !account) return false;
  if (backend === 'libsecret') {
    const { code } = await run('secret-tool', ['clear', 'service', SERVICE, 'account', account]);
    return code === 0;
  }
  const { code } = await run('security', ['delete-generic-password', '-s', SERVICE, '-a', account]);
  return code === 0 || code === NOT_FOUND;
}

// api keys and the copilot token

import { execFile } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { grantOwnerOnly } from './perms';
import { storePath } from './store';

const SERVICE = 'desmos-ide';
const NOT_FOUND = 44;

type Backend = 'keychain' | 'libsecret' | 'dpapi' | 'none';

let backend: Backend =
  process.platform === 'darwin' ? 'keychain' : process.platform === 'win32' ? 'dpapi' : 'none';

// dpapi ties the ciphertext to the windows account, so the file is only readable by the
// user who wrote it even if it is copied off the disk
const ACCOUNT = /^[A-Za-z0-9._-]+$/;
const POWERSHELL = ['-NoProfile', '-NonInteractive', '-Command', '-'];

function vaultPath(account: string): string {
  return storePath('secrets', `${account}.txt`);
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// the script goes over stdin, never over argv, because argv is readable by every process.
// PSModulePath is reset first: a parent process that sets it for powershell 7 stops
// windows powershell finding Microsoft.PowerShell.Security, and with it ConvertTo-SecureString
function powershell(script: string): Promise<Run> {
  const reset = `$env:PSModulePath = "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\Modules"\n`;
  return run('powershell', POWERSHELL, reset + script);
}

export function secretsAvailable(): boolean {
  return backend !== 'none';
}

// libsecret is not part of a minimal desktop, so the answer must be the real one
export async function probeSecrets(): Promise<void> {
  if (backend === 'keychain' || backend === 'dpapi') return;
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
  if (backend === 'dpapi') {
    if (!ACCOUNT.test(account)) return null;
    const { code, stdout } = await powershell(`
$path = ${psQuote(vaultPath(account))}
if (-not (Test-Path -LiteralPath $path)) { exit 44 }
$sealed = (Get-Content -LiteralPath $path -Raw).Trim()
$secure = ConvertTo-SecureString -String $sealed
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
`);
    return code === 0 && stdout ? stdout : null;
  }
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
  if (backend === 'dpapi') {
    if (!ACCOUNT.test(account)) return false;
    const path = vaultPath(account);
    try {
      mkdirSync(storePath('secrets'), { recursive: true });
    } catch {
      return false;
    }
    const packed = Buffer.from(value, 'utf-8').toString('base64');
    const { code } = await powershell(`
$plain = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${packed}'))
$secure = ConvertTo-SecureString -String $plain -AsPlainText -Force
ConvertFrom-SecureString -SecureString $secure | Set-Content -LiteralPath ${psQuote(path)} -Encoding ascii
`);
    if (code !== 0) return false;
    await grantOwnerOnly(path);
    return true;
  }
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
  if (backend === 'dpapi') {
    if (!ACCOUNT.test(account)) return false;
    try {
      rmSync(vaultPath(account), { force: true });
      return true;
    } catch {
      return false;
    }
  }
  if (backend === 'libsecret') {
    const { code } = await run('secret-tool', ['clear', 'service', SERVICE, 'account', account]);
    return code === 0;
  }
  const { code } = await run('security', ['delete-generic-password', '-s', SERVICE, '-a', account]);
  return code === 0 || code === NOT_FOUND;
}

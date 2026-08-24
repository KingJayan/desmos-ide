import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = join(tmpdir(), 'dsmx-probe');
mkdirSync(join(home, 'secrets'), { recursive: true });
const path = join(home, 'secrets', 'probe.txt');

const MODULE_PATH = `$env:PSModulePath = "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\Modules"\n`;

function ps(script: string, viaArgv = false): Promise<void> {
  return new Promise(resolve => {
    const args = viaArgv
      ? ['-EncodedCommand', Buffer.from(MODULE_PATH + script, 'utf16le').toString('base64')]
      : ['-Command', '-'];
    const child = execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', ...args],
      (err, stdout, stderr) => {
        console.log('err', err && (err as { code?: unknown }).code, JSON.stringify(err?.message ?? null));
        console.log('stdout', JSON.stringify(stdout));
        console.log('stderr', JSON.stringify(stderr));
        resolve();
      },
    );
    if (viaArgv) child.stdin?.end();
    else child.stdin?.end(MODULE_PATH + script);
  });
}

await ps(`
$secure = ConvertTo-SecureString -String 'hello' -AsPlainText -Force
ConvertFrom-SecureString -SecureString $secure | Set-Content -LiteralPath '${path}' -Encoding ascii
`);

await ps(`
$sealed = (Get-Content -LiteralPath '${path}' -Raw).Trim()
$secure = ConvertTo-SecureString -String $sealed
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr))) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
`, true);

console.log('--- stdin form, echoing a value');
await ps(`'hello-from-stdin'`);
console.log('--- argv form, echoing a value');
await ps(`'hello-from-argv'`, true);

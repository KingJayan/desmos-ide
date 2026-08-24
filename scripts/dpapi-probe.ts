import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = join(tmpdir(), 'dsmx-probe');
mkdirSync(join(home, 'secrets'), { recursive: true });
const path = join(home, 'secrets', 'probe.txt');

function ps(script: string): Promise<void> {
  return new Promise(resolve => {
    const child = execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', '-'],
      (err, stdout, stderr) => {
        console.log('err', err && (err as { code?: unknown }).code, JSON.stringify(err?.message ?? null));
        console.log('stdout', JSON.stringify(stdout));
        console.log('stderr', JSON.stringify(stderr));
        resolve();
      },
    );
    child.stdin?.end(`$env:PSModulePath = "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\Modules"\n` + script);
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
`);

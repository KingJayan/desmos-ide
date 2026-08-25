
import { execFile } from 'child_process';
import { userInfo } from 'os';

const WIN = process.platform === 'win32';

function account(): string {
  const { username } = userInfo();
  const domain = process.env['USERDOMAIN'];
  return domain ? `${domain}\\${username}` : username;
}

export function grantOwnerOnly(path: string): Promise<void> {
  if (!WIN) return Promise.resolve();
  return new Promise(resolve => {
    execFile(
      'icacls',
      [path, '/inheritance:r', '/grant:r', `${account()}:(F)`],
      { maxBuffer: 64 * 1024 },
      () => resolve(),
    );
  });
}

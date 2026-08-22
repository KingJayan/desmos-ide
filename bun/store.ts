import { homedir } from 'os';
import { join } from 'path';

// everything the app keeps outside the bundle. DSMX_HOME relocates it in tests,
// so it is read per call and never frozen at import time
export function storePath(...parts: string[]): string {
  return join(process.env.DSMX_HOME || join(homedir(), '.dsmx'), ...parts);
}

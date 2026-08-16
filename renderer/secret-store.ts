// where an api key lives

export interface SecretPorts {
  available: () => Promise<boolean>;
  get: (account: string) => Promise<string | null>;
  set: (account: string, value: string) => Promise<boolean>;
  remove: (account: string) => Promise<boolean>;
  legacy: () => Record<string, string>;
  clearLegacy: () => void;
}

export class SecretStore {
  private cache = new Map<string, string>();
  private ready: Promise<void> | null = null;

  secure = false;

  constructor(private ports: SecretPorts, private accounts: string[]) {}

  load(): Promise<void> {
    return (this.ready ??= this.doLoad());
  }

  private async doLoad(): Promise<void> {
    const legacy = this.ports.legacy();
    this.secure = await this.ports.available();

    if (!this.secure) {
      // no keychain
      for (const [account, value] of Object.entries(legacy)) {
        if (value) this.cache.set(account, value);
      }
      return;
    }

    for (const account of this.accounts) {
      const stored = await this.ports.get(account);
      if (stored) this.cache.set(account, stored);
    }

    let moved = false;
    for (const [account, value] of Object.entries(legacy)) {
      if (!value || this.cache.has(account)) continue;
      if (await this.ports.set(account, value)) {
        this.cache.set(account, value);
        moved = true;
      }
    }
    if (moved || Object.keys(legacy).length) this.ports.clearLegacy();
  }

  get(account: string): string {
    return this.cache.get(account) ?? '';
  }

  async set(account: string, value: string): Promise<void> {
    const trimmed = value.trim();
    if (trimmed) this.cache.set(account, trimmed);
    else this.cache.delete(account);

    if (!this.secure) return;
    if (trimmed) await this.ports.set(account, trimmed);
    else await this.ports.remove(account);
  }

  /** what may still be written to localStorage when there is no keychain */
  plaintext(): Record<string, string> {
    if (this.secure) return {};
    return Object.fromEntries(this.cache);
  }
}

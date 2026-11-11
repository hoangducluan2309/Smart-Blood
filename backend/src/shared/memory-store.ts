// shortcut: bo nho trong tien trinh, mat khi khoi dong lai va chi chay duoc 1 instance;
// khi can nhieu instance thi chuyen sang Redis.

interface StoreEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryStore {
  private readonly store = new Map<string, StoreEntry<unknown>>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs = 60_000) {
    this.cleanupTimer = setInterval(() => {
      this.purgeExpired();
    }, cleanupIntervalMs);
    this.cleanupTimer.unref();
  }

  public set<T>(key: string, options: { value: T; ttlSeconds: number }): void {
    const expiresAt = Date.now() + options.ttlSeconds * 1000;
    this.store.set(key, { value: options.value, expiresAt });
  }

  public get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public delete(key: string): void {
    this.store.delete(key);
  }

  public size(): number {
    return this.store.size;
  }

  public purgeExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  public dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }
}

export const TTL_POLICIES = {
  VAULT_OTP_SECONDS: 300,
  VAULT_OTP_MAX_ATTEMPTS: 3,
  EMAIL_OTP_SECONDS: 300,
  EMAIL_OTP_COOLDOWN_SECONDS: 60,
  EMAIL_OTP_MAX_ATTEMPTS: 5,
  CCCD_LOOKUP_WINDOW_SECONDS: 3600,
  CCCD_LOOKUP_MAX_FAILURES: 5,
  LOGIN_MAX_FAILURES: 5,
  LOGIN_LOCK_LEVELS_SECONDS: [180, 900, 3600] as const,
} as const;

export const memoryStore = new MemoryStore();

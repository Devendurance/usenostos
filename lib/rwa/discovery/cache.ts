export const IDENTITY_TTL_MS = 45 * 60 * 1000;
export const QUOTE_TTL_MS = 60 * 1000;

export type CacheRecord<T> = {
  value: T;
  storedAt: number;
  ttlMs: number;
};

export type MemoryCache = {
  get<T>(key: string): { value: T; stale: boolean } | null;
  set<T>(key: string, value: T, ttlMs: number): void;
  peek<T>(key: string): CacheRecord<T> | null;
  clear(): void;
};

export function createMemoryCache(now: () => number = () => Date.now()): MemoryCache {
  const store = new Map<string, CacheRecord<unknown>>();

  return {
    get<T>(key: string) {
      const entry = store.get(key) as CacheRecord<T> | undefined;
      if (!entry) return null;
      const stale = now() >= entry.storedAt + entry.ttlMs;
      return { value: entry.value, stale };
    },
    set<T>(key: string, value: T, ttlMs: number) {
      store.set(key, { value, storedAt: now(), ttlMs });
    },
    peek<T>(key: string) {
      return (store.get(key) as CacheRecord<T> | undefined) ?? null;
    },
    clear() {
      store.clear();
    },
  };
}

export async function readThrough<T>(
  cache: MemoryCache,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<{ value: T; stale: boolean }> {
  const existing = cache.get<T>(key);
  if (existing && !existing.stale) {
    return { value: existing.value, stale: false };
  }
  try {
    const value = await load();
    cache.set(key, value, ttlMs);
    return { value, stale: false };
  } catch (error) {
    if (existing) {
      return { value: existing.value, stale: true };
    }
    throw error;
  }
}

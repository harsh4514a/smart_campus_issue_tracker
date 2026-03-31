type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const globalCacheKey = "__smartCampusServerCache";

type GlobalWithServerCache = typeof globalThis & {
  [globalCacheKey]?: Map<string, CacheEntry<unknown>>;
};

const cacheStore = (() => {
  const globalWithCache = globalThis as GlobalWithServerCache;
  if (!globalWithCache[globalCacheKey]) {
    globalWithCache[globalCacheKey] = new Map<string, CacheEntry<unknown>>();
  }
  return globalWithCache[globalCacheKey]!;
})();

export function getFromCache<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setInCache<T>(key: string, value: T, ttlMs: number) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1000, ttlMs),
  });
}

export function deleteFromCache(key: string) {
  cacheStore.delete(key);
}

export function deleteFromCacheByPrefix(prefix: string) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

export async function getOrSetCache<T>(key: string, ttlMs: number, resolver: () => Promise<T>): Promise<T> {
  const cached = getFromCache<T>(key);
  if (cached !== null) return cached;

  const value = await resolver();
  setInCache(key, value, ttlMs);
  return value;
}

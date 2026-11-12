interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small LRU cache with TTL eviction.
 * - Use stable/primitive keys; avoid PII in keys.
 * - Do not cache secrets/tokens/PII; clear caches on sign-out where used in session scope.
 * - `memoize` uses JSON.stringify keying (sufficient for simple args; not collision-safe for complex objects).
 *   Pass a custom `keySerializer` for complex args (e.g., stable hash of sorted keys).
 */
export interface LruCacheOptions {
  max?: number;
  ttl?: number;
  /** Optional custom key serializer for complex arguments. Default: JSON.stringify. */
  keySerializer?: (...args: unknown[]) => string;
}

export function createLruCache<T>(options: LruCacheOptions = {}) {
  const max = options.max ?? 100;
  const ttl = options.ttl ?? 60_000;
  const _keySerializer = options.keySerializer ?? JSON.stringify;
  const map = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | undefined {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        map.delete(key);
        return undefined;
      }
      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    set(key: string, value: T): void {
      map.delete(key);
      map.set(key, { value, expiresAt: Date.now() + ttl });
      while (map.size > max) {
        const firstKey = map.keys().next().value;
        if (firstKey === undefined) break;
        map.delete(firstKey);
      }
    },
    has(key: string): boolean {
      const entry = map.get(key);
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        map.delete(key);
        return false;
      }
      return true;
    },
    delete(key: string): boolean {
      return map.delete(key);
    },
    clear(): void {
      map.clear();
    },
    get size(): number {
      return map.size;
    },
    /** Internal: expose map for testing only */
    _internalMap(): Map<string, CacheEntry<T>> {
      return map;
    },
  };
}

/** Registry of session-scoped caches to clear on sign-out. */
const sessionCaches: Array<{ clear(): void }> = [];

/** Register a cache instance to be cleared on sign-out. */
export function registerSessionCache(cache: { clear(): void }): void {
  sessionCaches.push(cache);
}

/** Clear all registered session-scoped caches. Call on sign-out. */
export function clearSessionCaches(): void {
  for (const cache of sessionCaches) {
    cache.clear();
  }
}

export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: LruCacheOptions = {},
): (...args: Parameters<T>) => ReturnType<T> {
  const cache = createLruCache<ReturnType<T>>(options);
  return (...args: Parameters<T>) => {
    const key = options.keySerializer ? options.keySerializer(...args) : JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  };
}

/** Stable key serializer: sorts object keys recursively for deterministic serialization. */
export function stableKeySerializer(...args: unknown[]): string {
  function normalize(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(normalize);
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      sorted[k] = normalize(obj[k]);
    }
    return sorted;
  }
  return JSON.stringify(args.map(normalize));
}
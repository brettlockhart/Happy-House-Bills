import { describe, it, expect, beforeEach } from "vitest";
import { createLruCache, memoize, stableKeySerializer, registerSessionCache, clearSessionCaches } from "~/utils/cache";
import { createCircuitBreaker } from "~/utils/circuit-breakers";

describe("cache.ts", () => {
  describe("createLruCache", () => {
    let cache: ReturnType<typeof createLruCache<string>>;

    beforeEach(() => {
      cache = createLruCache<string>({ max: 3, ttl: 1000 });
    });

    it("stores and retrieves values", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("returns undefined for missing keys", () => {
      expect(cache.get("missing")).toBeUndefined();
    });

    it("evicts oldest entries when max exceeded", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");
      cache.set("d", "4");
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBe("2");
      expect(cache.get("c")).toBe("3");
      expect(cache.get("d")).toBe("4");
    });

    it("respects TTL expiration", async () => {
      cache.set("key", "value");
      expect(cache.get("key")).toBe("value");
      await new Promise((r) => setTimeout(r, 1100));
      expect(cache.get("key")).toBeUndefined();
    });

    it("has reports correctly", () => {
      cache.set("key", "value");
      expect(cache.has("key")).toBe(true);
      expect(cache.has("missing")).toBe(false);
    });

    it("delete removes entries", () => {
      cache.set("key", "value");
      expect(cache.delete("key")).toBe(true);
      expect(cache.get("key")).toBeUndefined();
      expect(cache.delete("missing")).toBe(false);
    });

    it("clear removes all entries", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.clear();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
    });

    it("size reports correctly", () => {
      expect(cache.size).toBe(0);
      cache.set("a", "1");
      expect(cache.size).toBe(1);
      cache.set("b", "2");
      expect(cache.size).toBe(2);
    });

    it("has does not mutate LRU order", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");
      cache.has("a");
      cache.set("d", "4");
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBe("2");
      expect(cache.get("c")).toBe("3");
      expect(cache.get("d")).toBe("4");
    });

    it("memoize caches undefined return values", () => {
      let calls = 0;
      const fn = memoize((_x: number) => {
        calls++;
        return undefined;
      });
      expect(fn(1)).toBeUndefined();
      expect(fn(1)).toBeUndefined();
      expect(calls).toBe(1);
    });
  });

  describe("memoize", () => {
    it("caches function results", () => {
      let callCount = 0;
      const fn = memoize((x: number) => {
        callCount++;
        return x * 2;
      });

      expect(fn(5)).toBe(10);
      expect(fn(5)).toBe(10);
      expect(callCount).toBe(1);
    });

    it("caches different arguments separately", () => {
      let callCount = 0;
      const fn = memoize((x: number) => {
        callCount++;
        return x * 2;
      });

      expect(fn(5)).toBe(10);
      expect(fn(10)).toBe(20);
      expect(callCount).toBe(2);
    });

    it("respects TTL", async () => {
      let callCount = 0;
      const fn = memoize((x: number) => {
        callCount++;
        return x * 2;
      }, { ttl: 500 });

      expect(fn(5)).toBe(10);
      expect(fn(5)).toBe(10);
      expect(callCount).toBe(1);

      await new Promise((r) => setTimeout(r, 600));
      expect(fn(5)).toBe(10);
      expect(callCount).toBe(2);
    });

    it("uses custom keySerializer for complex args", () => {
      let callCount = 0;
      const fn = memoize(
        (obj: { b: number; a: number }) => {
          callCount++;
          return obj.a + obj.b;
        },
        { keySerializer: stableKeySerializer }
      );

      expect(fn({ a: 1, b: 2 })).toBe(3);
      expect(fn({ b: 2, a: 1 })).toBe(3);
      expect(callCount).toBe(1);
    });

    it("stableKeySerializer produces deterministic output", () => {
      const key1 = stableKeySerializer({ a: 1, b: 2 });
      const key2 = stableKeySerializer({ b: 2, a: 1 });
      expect(key1).toBe(key2);
    });

    it("stableKeySerializer handles nested objects and arrays", () => {
      const key1 = stableKeySerializer({ outer: { b: 2, a: 1 }, arr: [3, 1, 2] });
      const key2 = stableKeySerializer({ outer: { a: 1, b: 2 }, arr: [3, 1, 2] });
      // Nested objects get sorted keys, arrays maintain order
      expect(key1).toBe(key2);
    });

    it("stableKeySerializer sorts object keys but not array order", () => {
      const key1 = stableKeySerializer({ outer: { a: 1, b: 2 }, arr: [1, 2, 3] });
      const key2 = stableKeySerializer({ outer: { b: 2, a: 1 }, arr: [3, 2, 1] });
      // Different array order = different key
      expect(key1).not.toBe(key2);
    });
  });

  describe("session cache registry", () => {
    it("registerSessionCache and clearSessionCaches work together", () => {
      const cache1 = createLruCache<string>({ max: 10, ttl: 1000 });
      const cache2 = createLruCache<string>({ max: 10, ttl: 1000 });

      registerSessionCache(cache1);
      registerSessionCache(cache2);

      cache1.set("key1", "value1");
      cache2.set("key2", "value2");

      expect(cache1.get("key1")).toBe("value1");
      expect(cache2.get("key2")).toBe("value2");

      clearSessionCaches();

      expect(cache1.get("key1")).toBeUndefined();
      expect(cache2.get("key2")).toBeUndefined();
    });

    it("clearSessionCaches is idempotent", () => {
      const cache = createLruCache<string>({ max: 10, ttl: 1000 });
      registerSessionCache(cache);
      cache.set("key", "value");
      clearSessionCaches();
      clearSessionCaches();
      expect(cache.get("key")).toBeUndefined();
    });
  });
});

describe("circuit-breakers.ts", () => {
  describe("createCircuitBreaker", () => {
    let breaker: ReturnType<typeof createCircuitBreaker<() => Promise<string>>>;

    beforeEach(() => {
      breaker = createCircuitBreaker(async () => "success", {
        failureThreshold: 3,
        recoveryTimeout: 100,
        name: "test",
      });
    });

    it("starts in closed state", () => {
      expect(breaker.state).toBe("closed");
    });

    it("executes function in closed state", async () => {
      const result = await breaker();
      expect(result).toBe("success");
      expect(breaker.state).toBe("closed");
    });

    it("opens after threshold failures", async () => {
      const failingBreaker = createCircuitBreaker(async () => {
        throw new Error("fail");
      }, { failureThreshold: 2, recoveryTimeout: 1000, name: "fail" });

      await expect(failingBreaker()).rejects.toThrow("fail");
      expect(failingBreaker.state).toBe("closed");
      await expect(failingBreaker()).rejects.toThrow("fail");
      expect(failingBreaker.state).toBe("open");
    });

    it("rejects immediately when open", async () => {
      const failingBreaker = createCircuitBreaker(async () => {
        throw new Error("fail");
      }, { failureThreshold: 1, recoveryTimeout: 1000, name: "fail" });

      await expect(failingBreaker()).rejects.toThrow("fail");
      expect(failingBreaker.state).toBe("open");
      await expect(failingBreaker()).rejects.toThrow("Service temporarily unavailable");
    });

    it("enters half-open after recovery timeout", async () => {
      const failingBreaker = createCircuitBreaker(async () => {
        throw new Error("fail");
      }, { failureThreshold: 1, recoveryTimeout: 50, name: "fail" });

      await expect(failingBreaker()).rejects.toThrow("fail");
      expect(failingBreaker.state).toBe("open");

      await new Promise((r) => setTimeout(r, 60));
      // Calling transitions open → half-open, then fn fails → back to open.
      // Verify it attempted (threw "fail", not "is open").
      await expect(failingBreaker()).rejects.toThrow("fail");
      expect(failingBreaker.state).toBe("open");
    });

    it("closes on success in half-open", async () => {
      let shouldFail = true;
      const breaker = createCircuitBreaker(async () => {
        if (shouldFail) throw new Error("fail");
        return "ok";
      }, { failureThreshold: 1, recoveryTimeout: 50, name: "test" });

      await expect(breaker()).rejects.toThrow("fail");
      expect(breaker.state).toBe("open");

      await new Promise((r) => setTimeout(r, 60));
      // Trigger half-open transition (will fail and go back to open).
      await expect(breaker()).rejects.toThrow("fail");
      expect(breaker.state).toBe("open");

      shouldFail = false;
      await new Promise((r) => setTimeout(r, 70)); // wait past recovery timeout reset
      const result = await breaker();
      expect(result).toBe("ok");
      expect(breaker.state).toBe("closed");
    });

    it("resets state (test-only opt-in)", async () => {
      const failingBreaker = createCircuitBreaker(async () => {
        throw new Error("fail");
      }, { failureThreshold: 1, recoveryTimeout: 1000, name: "fail", _unsafeResetForTests: true });

      await expect(failingBreaker()).rejects.toThrow("fail");
      expect(failingBreaker.state).toBe("open");

      failingBreaker.reset?.();
      expect(failingBreaker.state).toBe("closed");
    });
  });
});
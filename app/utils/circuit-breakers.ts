type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  name?: string;
  /** Test-only escape hatch for deterministic state control. Not for production flow. */
  _unsafeResetForTests?: boolean;
}

export function createCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: CircuitBreakerOptions = {},
): T & { state: CircuitState; reset?: () => void } {
  const failureThreshold = options.failureThreshold ?? 5;
  const recoveryTimeout = options.recoveryTimeout ?? 30_000;

  let state: CircuitState = "closed";
  let failureCount = 0;
  let nextAttempt = 0;

  const reset = () => {
    state = "closed";
    failureCount = 0;
    nextAttempt = 0;
  };

  const wrapped = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (state === "open") {
      if (Date.now() < nextAttempt) {
        throw new Error("Service temporarily unavailable");
      }
      state = "half-open";
    }

    try {
      const result = (await fn(...args)) as ReturnType<T>;
      if (state === "half-open") {
        state = "closed";
        failureCount = 0;
      }
      return result;
    } catch (err) {
      failureCount++;
      if (failureCount >= failureThreshold) {
        state = "open";
        nextAttempt = Date.now() + recoveryTimeout;
      }
      throw err;
    }
  };

  const wrappedFn = wrapped as T & { state: CircuitState; reset?: () => void };
  Object.defineProperty(wrappedFn, "state", { get: () => state, enumerable: true });
  if (options._unsafeResetForTests) wrappedFn.reset = reset;
  return wrappedFn;
}
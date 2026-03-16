/** Configuration for the rate limiter */
export interface RateLimitOptions {
  /** Maximum number of attempts allowed within the window (default: 10) */
  maxAttempts?: number;
  /** Window duration in milliseconds (default: 15 minutes) */
  windowMs?: number;
  /** Disable rate limiting entirely (useful for tests) */
  disabled?: boolean;
}

/** Result of a rate limit check */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Seconds until the window resets (only meaningful when allowed is false) */
  retryAfter: number;
}

/** Rate limiter interface — can be replaced via the provider pattern */
export interface RateLimiter {
  /** Check whether a key (typically an IP) is within its rate limit */
  check(key: string): RateLimitResult;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface BucketEntry {
  count: number;
  windowStart: number;
}

/**
 * Creates an in-memory sliding-window rate limiter.
 *
 * Default: 10 attempts per 15-minute window (login).
 * Pass `{ disabled: true }` to bypass in test environments.
 */
export function createRateLimiter(options?: RateLimitOptions): RateLimiter {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const disabled = options?.disabled ?? false;

  const buckets = new Map<string, BucketEntry>();

  return {
    check(key: string): RateLimitResult {
      if (disabled) {
        return { allowed: true, retryAfter: 0 };
      }

      const now = Date.now();
      const entry = buckets.get(key);

      if (!entry || now - entry.windowStart > windowMs) {
        buckets.set(key, { count: 1, windowStart: now });
        return { allowed: true, retryAfter: 0 };
      }

      if (entry.count < maxAttempts) {
        entry.count++;
        return { allowed: true, retryAfter: 0 };
      }

      const elapsed = now - entry.windowStart;
      const retryAfter = Math.ceil((windowMs - elapsed) / 1000);
      return { allowed: false, retryAfter };
    },
  };
}

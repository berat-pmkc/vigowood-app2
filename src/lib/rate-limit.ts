/**
 * Simple in-memory rate limiter for API routes.
 * Suitable for small user base (56 users) on serverless.
 * Token bucket resets per window (sliding window).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (every 60s)
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (IP or user ID).
 * Returns { success, limit, remaining, resetAt }.
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= options.limit) {
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  return {
    success: true,
    limit: options.limit,
    remaining: options.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get a rate limit key from request (IP-based).
 */
export function getRateLimitKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `${prefix}:${ip}`;
}

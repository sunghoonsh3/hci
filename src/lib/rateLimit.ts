/**
 * In-memory token-bucket rate limiter.
 *
 * LIMITATION: state is per process. On Vercel Serverless each invocation may
 * land on a different instance, so the *effective* limit is
 *   (limit × warm-instances).
 * This is suitable for burst protection and single-instance dev/demo, but not
 * for production DDoS defense. For shared state use one of:
 *   - @upstash/ratelimit (Upstash Redis HTTP API; auto-provisioned on Vercel)
 *   - Vercel Firewall rate limiting rules (platform-level)
 *   - Vercel Runtime Cache (beta) with atomic increments
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    if (buckets.size > 10_000) pruneExpired(now);
    return { ok: true, remaining: limit - 1, limit, resetAt };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      limit,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: limit - bucket.count,
    limit,
    resetAt: bucket.resetAt,
  };
}

function pruneExpired(now: number) {
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

/**
 * Best-effort client IP extraction.
 * Vercel sets `x-forwarded-for` on all production requests; the other headers
 * cover Cloudflare, Fly.io, and common reverse-proxy setups. Returns `null`
 * when no header is present so the caller can decide whether to refuse.
 */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fly = req.headers.get("fly-client-ip");
  if (fly) return fly;
  return null;
}

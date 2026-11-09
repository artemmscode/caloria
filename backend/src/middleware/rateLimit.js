import crypto from 'node:crypto';
import { tooMany } from '../utils/errors.js';

/**
 * Small dependency-free sliding-window limiter. Suitable for a single Render
 * instance; swap for Redis when horizontally scaling.
 */
export function createRateLimiter({ windowMs = 60_000, max = 120, keyFn = (req) => req.ip } = {}) {
  const buckets = new Map();
  let lastCleanup = Date.now();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    if (now - lastCleanup > windowMs * 2) {
      for (const [key, bucket] of buckets) {
        if (bucket.reset <= now) buckets.delete(key);
      }
      lastCleanup = now;
    }
    const key = keyFn(req) || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.reset <= now) {
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.reset - now) / 1000)));
      return next(tooMany());
    }
    return next();
  };
}

/** Idempotency for mutations: repeated identical requests return the first result. */
export function createIdempotency() {
  const cache = new Map();

  return function idempotency(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const key = req.headers['x-idempotency-key'];
    if (!key || typeof key !== 'string' || key.length > 120) return next();

    const userId =
      req.userId ||
      crypto
        .createHash('sha256')
        .update(String(req.headers.authorization || 'anon'))
        .digest('hex')
        .slice(0, 24);
    const cacheKey = `${userId}:${req.method}:${req.path}:${key}`;
    const now = Date.now();
    for (const [entryKey, entry] of cache) {
      if (entry.expires <= now) cache.delete(entryKey);
    }
    const existing = cache.get(cacheKey);
    if (existing) {
      return res.status(existing.status).json({ ...existing.body, idempotentReplay: true });
    }
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 500) cache.set(cacheKey, { status: res.statusCode, body, expires: now + 10 * 60_000 });
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
      return originalJson(body);
    };
    return next();
  };
}

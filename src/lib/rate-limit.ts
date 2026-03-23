import { NextRequest } from 'next/server';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60_000;
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  limit?: number;
  scope?: string;
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const scope = options.scope ?? 'global';
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const clientIp = getClientIp(request);
  const now = Date.now();
  const storeKey = `${scope}:${clientIp}`;

  pruneExpiredEntries(now);

  const current = rateLimitStore.get(storeKey);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  entry.count += 1;
  rateLimitStore.set(storeKey, entry);

  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((entry.resetAt - now) / 1000)
  );

  return {
    allowed,
    limit,
    remaining,
    resetAt: entry.resetAt,
    retryAfterSeconds,
  };
}

export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: '请求过于频繁，请稍后再试',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(',');
    const normalized = firstIp.trim();
    if (normalized) return normalized;
  }

  const realIp =
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip');

  return realIp?.trim() || 'unknown';
}

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

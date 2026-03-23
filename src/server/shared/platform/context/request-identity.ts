import type {
  PlatformRequestIdentity,
  PlatformRequestLike,
} from './types';
import { parseSessionFromCookieHeader } from '@/server/auth/session';

const REQUEST_ID_HEADER_CANDIDATES = [
  'x-request-id',
  'x-correlation-id',
  'x-amzn-trace-id',
] as const;

const USER_ID_HEADER_CANDIDATES = [
  'x-user-id',
  'x-auth-user-id',
  'x-actor-id',
] as const;

const SESSION_ID_HEADER_CANDIDATES = [
  'x-session-id',
  'x-auth-session-id',
] as const;

export function createPlatformRequestIdentity(
  request: PlatformRequestLike
): PlatformRequestIdentity {
  return {
    requestId: resolveHeaderValue(request, REQUEST_ID_HEADER_CANDIDATES) ?? createFallbackId('req'),
    traceId: resolveTraceId(request) ?? createFallbackId('trace'),
    clientIp: resolveClientIp(request),
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
    locale: request.headers.get('accept-language'),
  };
}

export function resolveActorIdentity(request: PlatformRequestLike) {
  const session = parseSessionFromCookieHeader(request.headers.get('cookie'));

  return {
    userId: resolveHeaderValue(request, USER_ID_HEADER_CANDIDATES) ?? session?.userId ?? null,
    sessionId:
      resolveHeaderValue(request, SESSION_ID_HEADER_CANDIDATES) ??
      (session ? `${session.userId}:${session.organizationId}` : null) ??
      null,
  };
}

function resolveHeaderValue(
  request: PlatformRequestLike,
  candidates: readonly string[]
): string | null {
  for (const header of candidates) {
    const value = request.headers.get(header)?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function resolveTraceId(request: PlatformRequestLike): string | null {
  const traceparent = request.headers.get('traceparent');
  if (traceparent?.trim()) {
    return traceparent.trim();
  }

  const b3TraceId = request.headers.get('x-b3-traceid')?.trim();
  return b3TraceId || null;
}

function resolveClientIp(request: PlatformRequestLike): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const directIp =
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip');

  return directIp?.trim() || 'unknown';
}

function createFallbackId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

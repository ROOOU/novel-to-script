import { createHmac, timingSafeEqual } from 'node:crypto';
import { auth, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import type { SupportedLocale } from '@/server/shared/platform/domain';
import type { ClerkIdentityInput } from './service';

export const AUTH_COOKIE_NAME = 'novelscript_session';

export interface AppSession {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  workspaceId: string;
  locale: SupportedLocale;
  issuedAt: string;
}

export async function getCurrentClerkIdentity(): Promise<ClerkIdentityInput | null> {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const primaryEmail = user?.emailAddresses.find(
    (candidate) => candidate.id === user.primaryEmailAddressId
  );

  if (!user || !primaryEmail?.emailAddress) {
    throw new Error('CLERK_PRIMARY_EMAIL_MISSING');
  }

  return {
    authUserId: userId,
    email: primaryEmail.emailAddress,
    emailVerified: primaryEmail.verification?.status === 'verified',
    displayName:
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      primaryEmail.emailAddress.split('@')[0] ||
      'Creator',
    avatarUrl: user.imageUrl,
    locale: resolveClerkLocale(user.publicMetadata?.locale),
  };
}

export function createSessionToken(session: AppSession): string {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | null | undefined): AppSession | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expected = signValue(payload);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(payload)) as AppSession;
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function parseSessionFromCookieHeader(cookieHeader: string | null | undefined): AppSession | null {
  if (!cookieHeader) {
    return null;
  }

  const token = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split('=')
    .slice(1)
    .join('=');

  return verifySessionToken(token ? decodeURIComponent(token) : null);
}

function signValue(value: string): string {
  return toBase64Url(
    createHmac('sha256', getAuthSecret())
      .update(value)
      .digest('base64')
  );
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || process.env.NOVELSCRIPT_AUTH_SECRET || 'novelscript-dev-secret';
}

function toBase64Url(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveClerkLocale(value: unknown): SupportedLocale {
  return value === 'zh-CN' ? 'zh-CN' : 'en-US';
}

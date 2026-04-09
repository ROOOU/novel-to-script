import { clerkClient, verifyToken } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { isSupportedLocale } from '@/i18n/config';
import { authenticateTrustedUser } from '@/server/auth/service';
import { AUTH_COOKIE_NAME, createSessionToken } from '@/server/auth/session';

export async function POST(request: NextRequest) {
  try {
    const bearerToken = getBearerToken(request.headers.get('authorization'));
    const cookieToken = getCookieValue(request, '__session');
    if (!bearerToken && !cookieToken) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = await resolveUserId({
      bearerToken,
      cookieToken,
    });
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const hasGoogleIdentity = Array.isArray(user.externalAccounts)
      && user.externalAccounts.some((account) => {
        const provider = String(account.provider ?? '').toLowerCase();
        return provider === 'google' || provider === 'oauth_google';
      });
    if (!hasGoogleIdentity) {
      return NextResponse.json({ ok: false, error: 'GOOGLE_ACCOUNT_REQUIRED' }, { status: 403 });
    }

    const primaryEmail =
      user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress;
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: 'MISSING_EMAIL' }, { status: 400 });
    }

    const localeQuery = new URL(request.url).searchParams.get('locale');
    const locale = isSupportedLocale(localeQuery) ? localeQuery : 'zh-CN';
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.fullName ||
      user.username ||
      primaryEmail.split('@')[0];

    const session = await authenticateTrustedUser({
      email: primaryEmail,
      displayName,
      locale,
    });

    const token = createSessionToken(session);
    const response = NextResponse.json({ ok: true, session });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    console.error('[auth/session/clerk] unexpected failure', error);
    const message = error instanceof Error ? error.message.toUpperCase() : '';
    if (message.includes('TOKEN') || message.includes('JWT') || message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'AUTH_FAILED' }, { status: 400 });
  }
}

async function resolveUserId(input: {
  bearerToken: string | null;
  cookieToken: string | null;
}): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (input.bearerToken) {
    try {
      const verified = await verifyToken(input.bearerToken, { secretKey });
      if (verified?.sub) {
        return verified.sub;
      }
    } catch {
      // Ignore and fallback to cookie token verification.
    }
  }

  if (input.cookieToken) {
    const verified = await verifyToken(input.cookieToken, { secretKey });
    return verified?.sub ?? null;
  }

  return null;
}

function getBearerToken(rawAuthorization: string | null): string | null {
  if (!rawAuthorization) {
    return null;
  }

  const [scheme, ...rest] = rawAuthorization.trim().split(/\s+/);
  if (scheme.toLowerCase() !== 'bearer' || rest.length === 0) {
    return null;
  }

  const token = rest.join(' ').trim();
  return token || null;
}

function getCookieValue(request: NextRequest, key: string): string | null {
  const raw = request.cookies.get(key)?.value;
  if (!raw) {
    return null;
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

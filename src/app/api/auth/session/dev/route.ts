import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupportedLocale } from '@/i18n/config';
import { authenticateTrustedUser } from '@/server/auth/service';
import { getDevAccessProfile, isDevAccessEnabled } from '@/server/auth/dev-access';
import { AUTH_COOKIE_NAME, createSessionToken } from '@/server/auth/session';

const devSessionSchema = z.object({
  locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!isDevAccessEnabled()) {
    return NextResponse.json({ ok: false, error: 'DEV_AUTH_DISABLED' }, { status: 403 });
  }

  try {
    const parsedBody = await parseOptionalJson(request);
    const body = devSessionSchema.parse(parsedBody ?? {});
    const locale = isSupportedLocale(body.locale) ? body.locale : 'zh-CN';
    const profile = getDevAccessProfile(locale);
    const session = await authenticateTrustedUser({
      email: profile.email,
      displayName: profile.displayName,
      locale,
    });

    const token = createSessionToken(session);
    const response = NextResponse.json({
      ok: true,
      session,
    });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    console.error('[auth/session/dev] unexpected failure', error);
    const message = error instanceof z.ZodError ? 'INVALID_REQUEST' : 'AUTH_FAILED';

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    );
  }
}

async function parseOptionalJson(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  return request.json();
}

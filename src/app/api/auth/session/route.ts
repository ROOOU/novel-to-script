import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupportedLocale } from '@/i18n/config';
import { authenticateUser } from '@/server/auth/service';
import { AUTH_COOKIE_NAME, createSessionToken } from '@/server/auth/session';

const sessionSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = sessionSchema.parse(await request.json());
    const locale = isSupportedLocale(body.locale) ? body.locale : 'zh-CN';
    const session = await authenticateUser({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
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
    const message =
      error instanceof Error && error.message === 'INVALID_CREDENTIALS'
        ? 'INVALID_CREDENTIALS'
        : error instanceof Error
          ? error.message
          : 'AUTH_FAILED';

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
  return response;
}

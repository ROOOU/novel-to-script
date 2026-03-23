import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  buildLocalizedPath,
  isSupportedLocale,
  resolveLocaleFromAcceptLanguage,
} from '@/i18n/config';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const explicitLocale = segments[0];

  if (isSupportedLocale(explicitLocale)) {
    const response = NextResponse.next();
    response.cookies.set(LOCALE_COOKIE_NAME, explicitLocale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isSupportedLocale(cookieLocale)
    ? cookieLocale
    : resolveLocaleFromAcceptLanguage(request.headers.get('accept-language')) || DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = buildLocalizedPath(locale, pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

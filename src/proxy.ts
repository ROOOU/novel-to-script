import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  buildLocalizedPath,
  isSupportedLocale,
  resolveLocaleFromAcceptLanguage,
} from '@/i18n/config';

const isProtectedRoute = createRouteMatcher([
  '/:locale/projects(.*)',
  '/:locale/billing(.*)',
  '/api/projects(.*)',
  '/api/billing(.*)',
]);

const isProtectedApiRoute = createRouteMatcher([
  '/api/projects(.*)',
  '/api/billing(.*)',
]);

const isProtectedPageRoute = createRouteMatcher([
  '/:locale/projects(.*)',
  '/:locale/billing(.*)',
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (isProtectedApiRoute(request)) {
    const authState = await auth();
    if (!authState.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }
  } else if (isProtectedPageRoute(request)) {
    const authState = await auth();
    if (!authState.userId) {
      const locale = resolveRequestLocale(request);
      const signInUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(signInUrl);
    }
  } else if (isProtectedRoute(request)) {
    await auth.protect();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/sign-in' ||
    pathname.startsWith('/sign-in/') ||
    pathname === '/sign-up' ||
    pathname.startsWith('/sign-up/') ||
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
});

function resolveRequestLocale(request: NextRequest) {
  const explicitLocale = request.nextUrl.pathname.split('/').filter(Boolean)[0];
  if (isSupportedLocale(explicitLocale)) {
    return explicitLocale;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  return isSupportedLocale(cookieLocale)
    ? cookieLocale
    : resolveLocaleFromAcceptLanguage(request.headers.get('accept-language')) || DEFAULT_LOCALE;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

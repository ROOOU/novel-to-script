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
import { buildLocalizedLoginRedirect } from '@/server/auth/http';

const isProtectedRoute = createRouteMatcher([
  '/:locale/projects(.*)',
  '/:locale/billing(.*)',
  '/:locale/admin(.*)',
  '/:locale/redeem(.*)',
  '/:locale/dev-testing(.*)',
  '/api/projects(.*)',
  '/api/billing(.*)',
  '/api/admin(.*)',
  '/api/redeem-codes(.*)',
  '/api/artifacts(.*)',
]);

const isProtectedApiRoute = createRouteMatcher([
  '/api/projects(.*)',
  '/api/billing(.*)',
  '/api/admin(.*)',
  '/api/redeem-codes(.*)',
  '/api/artifacts(.*)',
]);

const isProtectedPageRoute = createRouteMatcher([
  '/:locale/projects(.*)',
  '/:locale/billing(.*)',
  '/:locale/admin(.*)',
  '/:locale/redeem(.*)',
  '/:locale/dev-testing(.*)',
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const canonicalRedirect = getCanonicalRedirectResponse(request);
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  if (isProtectedApiRoute(request)) {
    const authState = await auth();
    if (!authState.userId) {
      logAuthDebug('api_unauthorized', request);
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
      logAuthDebug('page_unauthorized', request);
      const locale = resolveRequestLocale(request);
      const localizedPath = request.nextUrl.pathname.slice(locale.length + 1) || '/';
      return NextResponse.redirect(
        new URL(buildLocalizedLoginRedirect(locale, `${localizedPath}${request.nextUrl.search}`), request.url)
      );
    }
  } else if (isProtectedRoute(request)) {
    await auth.protect();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/v1') ||
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

function getCanonicalRedirectResponse(request: NextRequest) {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredAppUrl || process.env.VERCEL_ENV === 'preview') {
    return null;
  }

  const canonicalUrl = new URL(configuredAppUrl);
  const requestHost = request.nextUrl.host;
  if (!requestHost.endsWith('.vercel.app') || requestHost === canonicalUrl.host) {
    return null;
  }

  const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalUrl);
  return NextResponse.redirect(redirectUrl);
}

function logAuthDebug(reason: 'api_unauthorized' | 'page_unauthorized', request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/billing') && !request.nextUrl.pathname.includes('/projects')) {
    return;
  }

  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  console.info('[auth-debug]', {
    reason,
    host: request.nextUrl.host,
    pathname: request.nextUrl.pathname,
    hasSessionCookie: cookieNames.includes('__session'),
    hasClientUatCookie: cookieNames.includes('__client_uat'),
    clerkCookies: cookieNames.filter((name) => name.startsWith('__clerk') || name.startsWith('__client')),
  });
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

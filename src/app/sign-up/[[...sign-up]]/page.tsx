import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE_NAME, isSupportedLocale, resolveLocaleFromAcceptLanguage } from '@/i18n/config';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const locale = await resolvePreferredLocale();
  const params = await searchParams;
  const redirectUrl = await resolveRedirectUrl(params.redirect_url, locale);
  redirect(buildLocalizedSignUpUrl(locale, redirectUrl));
}

async function resolvePreferredLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  const requestHeaders = await headers();
  return resolveLocaleFromAcceptLanguage(requestHeaders.get('accept-language'));
}

async function resolveRedirectUrl(redirectUrl: string | undefined, locale: string) {
  const normalized = redirectUrl?.trim();
  if (!normalized) {
    return `/${locale}/projects`;
  }

  const allowedOrigin = await resolveAllowedOrigin();
  const safeRedirect = normalizeRedirectTarget(normalized, allowedOrigin);
  return safeRedirect ?? `/${locale}/projects`;
}

function buildLocalizedSignUpUrl(locale: string, redirectUrl: string) {
  return redirectUrl
    ? `/${locale}/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
    : `/${locale}/sign-up`;
}

async function resolveAllowedOrigin() {
  const requestHeaders = await headers();
  const headerOrigin = requestHeaders.get('origin')?.trim();
  if (headerOrigin) {
    return headerOrigin;
  }

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredAppUrl) {
    return new URL(configuredAppUrl).origin;
  }

  const host = requestHeaders.get('x-forwarded-host')?.trim() || requestHeaders.get('host')?.trim();
  if (!host) {
    return null;
  }

  const proto = requestHeaders.get('x-forwarded-proto')?.trim() || 'https';
  return `${proto}://${host}`;
}

function normalizeRedirectTarget(redirectUrl: string, allowedOrigin: string | null) {
  if (redirectUrl.startsWith('//')) {
    return null;
  }

  if (redirectUrl.startsWith('/')) {
    return isSafeLocalizedPath(redirectUrl) ? redirectUrl : null;
  }

  if (!allowedOrigin) {
    return null;
  }

  try {
    const parsed = new URL(redirectUrl);
    if (parsed.origin !== allowedOrigin) {
      return null;
    }

    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return isSafeLocalizedPath(path) ? path : null;
  } catch {
    return null;
  }
}

function isSafeLocalizedPath(path: string) {
  const [firstSegment] = path.split('/').filter(Boolean);
  return isSupportedLocale(firstSegment);
}

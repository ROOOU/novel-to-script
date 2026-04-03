import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { LoginForm } from '@/features/saas/LoginForm';
import { isSupportedLocale } from '@/i18n/config';
import { resolveViewerSafely } from '@/server/auth/http';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ redirect_url?: string }>;
}) {
  const { locale } = await params;
  const { redirect_url: redirectUrl } = (await searchParams) ?? {};
  const viewer = await resolveViewerSafely();
  if (viewer) {
    redirect(`/${viewer.workspace.defaultLocale ?? locale}/projects`);
  }

  const resolvedLocale = isSupportedLocale(locale) ? locale : 'zh-CN';
  return <LoginForm locale={resolvedLocale} redirectUrl={await resolveRedirectUrl(redirectUrl?.trim(), resolvedLocale)} />;
}

async function resolveRedirectUrl(redirectUrl: string | undefined, locale: string) {
  if (!redirectUrl) {
    return `/${locale}/projects`;
  }

  const allowedOrigin = await resolveAllowedOrigin();
  const safeRedirect = normalizeRedirectTarget(redirectUrl, allowedOrigin);
  return safeRedirect ?? `/${locale}/projects`;
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

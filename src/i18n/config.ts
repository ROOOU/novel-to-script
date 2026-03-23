import type { SupportedLocale } from '@/server/shared/platform/domain';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['zh-CN', 'en-US'] as const;
export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN';
export const LOCALE_COOKIE_NAME = 'novelscript_locale';

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function resolveLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined
): SupportedLocale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const normalized = acceptLanguage.toLowerCase();
  if (normalized.includes('en-us') || normalized.includes('en')) {
    return 'en-US';
  }

  return 'zh-CN';
}

export function stripLocalePrefix(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname === `/${locale}`) {
      return '/';
    }

    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }

  return pathname;
}

export function buildLocalizedPath(locale: SupportedLocale, pathname: string): string {
  const normalizedPath = stripLocalePrefix(pathname);
  if (normalizedPath === '/') {
    return `/${locale}`;
  }
  return `/${locale}${normalizedPath}`;
}

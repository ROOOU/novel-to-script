import { resolveLocaleFromAcceptLanguage } from '@/i18n/config';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface LegacyRedirectInput {
  viewerLocale?: SupportedLocale | null;
  acceptLanguage?: string | null;
}

export function resolveLegacyConsoleRedirect(input: LegacyRedirectInput): string {
  const locale = resolveLegacyLocale(input);
  return `/${locale}/projects`;
}

export function resolveLegacyStoryboardRedirect(input: LegacyRedirectInput): string {
  const locale = resolveLegacyLocale(input);
  if (input.viewerLocale) {
    return `/${locale}/projects`;
  }

  return `/${locale}`;
}

function resolveLegacyLocale({ viewerLocale, acceptLanguage }: LegacyRedirectInput): SupportedLocale {
  if (viewerLocale) {
    return viewerLocale;
  }

  return resolveLocaleFromAcceptLanguage(acceptLanguage);
}

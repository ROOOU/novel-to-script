'use client';

import { SignIn } from '@clerk/nextjs';
import { isSupportedLocale } from '@/i18n/config';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface LoginFormProps {
  locale: SupportedLocale;
  redirectUrl?: string;
}

export function LoginForm({ locale, redirectUrl }: LoginFormProps) {
  const fallbackRedirectUrl = resolveFallbackRedirectUrl(redirectUrl, locale);

  return (
    <div className="marketing-shell">
      <div className="auth-card">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl={`/${locale}/sign-up`}
          fallbackRedirectUrl={fallbackRedirectUrl}
        />
      </div>
    </div>
  );
}

function resolveFallbackRedirectUrl(redirectUrl: string | undefined, locale: SupportedLocale) {
  if (!redirectUrl || redirectUrl.startsWith('//')) {
    return `/${locale}/projects`;
  }

  return isSafeLocalizedPath(redirectUrl) ? redirectUrl : `/${locale}/projects`;
}

function isSafeLocalizedPath(path: string) {
  const [firstSegment] = path.split('/').filter(Boolean);
  return isSupportedLocale(firstSegment);
}

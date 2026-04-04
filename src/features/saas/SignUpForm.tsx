'use client';

import { SignUp } from '@clerk/nextjs';
import { isSupportedLocale } from '@/i18n/config';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface SignUpFormProps {
  locale: SupportedLocale;
  redirectUrl?: string;
}

export function SignUpForm({ locale, redirectUrl }: SignUpFormProps) {
  const fallbackRedirectUrl = resolveFallbackRedirectUrl(redirectUrl, locale);

  return (
    <div className="marketing-shell">
      <div className="auth-card">
        <SignUp
          routing="path"
          path={`/${locale}/sign-up`}
          signInUrl={`/${locale}/login`}
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

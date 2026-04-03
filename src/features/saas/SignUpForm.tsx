'use client';

import { SignUp } from '@clerk/nextjs';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface SignUpFormProps {
  locale: SupportedLocale;
  redirectUrl?: string;
}

export function SignUpForm({ locale, redirectUrl }: SignUpFormProps) {
  return (
    <div className="marketing-shell">
      <div className="auth-card">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl={`/${locale}/login`}
          fallbackRedirectUrl={redirectUrl ?? `/${locale}/projects`}
        />
      </div>
    </div>
  );
}

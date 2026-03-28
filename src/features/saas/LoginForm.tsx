'use client';

import { SignIn } from '@clerk/nextjs';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface LoginFormProps {
  locale: SupportedLocale;
}

export function LoginForm({ locale }: LoginFormProps) {
  return (
    <div className="marketing-shell">
      <div className="auth-card">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl={`/${locale}/projects`}
        />
      </div>
    </div>
  );
}

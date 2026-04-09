'use client';

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface GoogleOnlySignInButtonProps {
  locale: SupportedLocale;
  callbackPath: string;
  buttonLabel: string;
  hint: string;
}

export function GoogleOnlySignInButton({
  locale,
  callbackPath,
  buttonLabel,
  hint,
}: GoogleOnlySignInButtonProps) {
  const { signIn, fetchStatus } = useSignIn();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = Boolean(signIn) && fetchStatus === 'idle';

  async function handleGoogleSignIn() {
    if (!ready || pending) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await signIn.sso({
        strategy: 'oauth_google',
        redirectUrl: callbackPath,
        redirectCallbackUrl: `/${locale}/sso-callback`,
      });
    } catch (error) {
      const code = resolveClerkErrorCode(error);
      if (code === 'session_exists') {
        window.location.assign(callbackPath);
        return;
      }
      setError(locale === 'en-US' ? 'Google sign-in failed. Please try again.' : 'Google 登录失败，请重试。');
      setPending(false);
    }
  }

  return (
    <div className="auth-actions">
      <button
        type="button"
        className="primary-button"
        onClick={handleGoogleSignIn}
        disabled={!ready || pending}
      >
        {pending
          ? locale === 'en-US'
            ? 'Redirecting to Google...'
            : '正在跳转到 Google...'
          : buttonLabel}
      </button>
      <p>{hint}</p>
      {error ? <p className="error-message">{error}</p> : null}
    </div>
  );
}

function resolveClerkErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const errors = Reflect.get(error, 'errors');
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  const firstError = errors[0];
  if (!firstError || typeof firstError !== 'object') {
    return null;
  }

  const code = Reflect.get(firstError, 'code');
  return typeof code === 'string' ? code : null;
}

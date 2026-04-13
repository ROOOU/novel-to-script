'use client';

import { useEffect, useState } from 'react';
import { useAuth, useSignIn } from '@clerk/nextjs';
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
  const { isLoaded: authLoaded, userId } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = Boolean(signIn) && fetchStatus === 'idle';

  useEffect(() => {
    if (!authLoaded || !userId) {
      return;
    }

    setPending(true);
    redirectToCallback(callbackPath);
  }, [authLoaded, callbackPath, userId]);

  async function handleGoogleSignIn() {
    if (pending) {
      return;
    }

    if (authLoaded && userId) {
      setPending(true);
      redirectToCallback(callbackPath);
      return;
    }

    if (!ready) {
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
      setPending(false);
    } catch (error) {
      const code = resolveClerkErrorCode(error);
      if (code === 'session_exists') {
        redirectToCallback(callbackPath);
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

function redirectToCallback(callbackPath: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.location.replace(callbackPath);
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

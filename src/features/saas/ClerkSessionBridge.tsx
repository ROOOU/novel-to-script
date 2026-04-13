'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface ClerkSessionBridgeProps {
  locale: SupportedLocale;
  redirectUrl?: string;
}

function resolveNextPath(locale: SupportedLocale, redirectUrl?: string): string {
  if (!redirectUrl) {
    return `/${locale}/projects`;
  }

  if (redirectUrl.startsWith('/')) {
    return redirectUrl;
  }

  try {
    const parsed = new URL(redirectUrl);
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // ignore invalid redirect
  }

  return `/${locale}/projects`;
}

export function ClerkSessionBridge({ locale, redirectUrl }: ClerkSessionBridgeProps) {
  const router = useRouter();
  const { isLoaded, userId, getToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const nextPath = useMemo(() => resolveNextPath(locale, redirectUrl), [locale, redirectUrl]);

  useEffect(() => {
    if (!isLoaded || !userId) {
      return;
    }

    let active = true;

    async function bridgeSession() {
      let lastErrorCode: string | undefined;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const clerkToken = await getToken().catch(() => null);
        const response = await postBridgeRequest(locale, clerkToken ?? undefined);
        if (!active) {
          return;
        }

        if (response.ok) {
          navigateToNextPath(nextPath, router);
          return;
        }

        lastErrorCode = response.payload?.error;
        if (response.status !== 401 || response.payload?.error !== 'UNAUTHORIZED') {
          setError(resolveBridgeError(locale, response.payload?.error));
          return;
        }

        if (attempt < 2) {
          await wait(150);
        }
      }

      setError(resolveBridgeError(locale, lastErrorCode ?? 'UNAUTHORIZED'));
    }

    bridgeSession().catch(() => {
      if (active) {
        setError(resolveBridgeError(locale));
      }
    });

    return () => {
      active = false;
    };
  }, [getToken, isLoaded, locale, nextPath, router, userId]);

  return (
    <div className="marketing-shell">
      <div className="auth-card">
        <h1>正在完成登录</h1>
        <p>请稍候，我们正在同步你的账号信息。</p>
        {error ? <p className="error-message">{error}</p> : null}
      </div>
    </div>
  );
}

async function postBridgeRequest(locale: SupportedLocale, clerkToken?: string): Promise<{
  ok: boolean;
  status: number;
  payload: { ok?: boolean; error?: string } | null;
}> {
  const headers: HeadersInit = {};
  if (clerkToken) {
    headers.Authorization = `Bearer ${clerkToken}`;
  }

  const response = await fetch(`/api/auth/session/clerk?locale=${locale}`, {
    method: 'POST',
    headers,
    cache: 'no-store',
    credentials: 'same-origin',
  });

  let payload: { ok?: boolean; error?: string } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    ok: response.ok && payload?.ok === true,
    status: response.status,
    payload,
  };
}

function navigateToNextPath(nextPath: string, router: ReturnType<typeof useRouter>) {
  if (typeof window !== 'undefined') {
    window.location.replace(nextPath);
    return;
  }

  router.replace(nextPath);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBridgeError(locale: SupportedLocale, code?: string): string {
  if (code === 'GOOGLE_ACCOUNT_REQUIRED') {
    return locale === 'en-US'
      ? 'Please sign in with your Google account.'
      : '请使用 Google 账号登录。';
  }

  if (code === 'UNAUTHORIZED') {
    return locale === 'en-US'
      ? 'Your login state is not ready yet. Please retry in a moment.'
      : '登录状态尚未完成同步，请稍后重试。';
  }

  return locale === 'en-US'
    ? 'Sign-in sync failed. Please try again.'
    : '登录同步失败，请重试。';
}

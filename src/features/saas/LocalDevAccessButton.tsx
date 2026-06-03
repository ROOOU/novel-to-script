'use client';

import { useMemo, useState } from 'react';
import { WorkspaceFeedback } from '@/components/WorkspaceUI';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface LocalDevAccessButtonProps {
  locale: SupportedLocale;
  redirectUrl?: string;
}

export function LocalDevAccessButton({
  locale,
  redirectUrl,
}: LocalDevAccessButtonProps) {
  const copy = useMemo(() => getLocalDevAccessCopy(locale), [locale]);
  const nextPath = useMemo(() => resolveNextPath(locale, redirectUrl), [locale, redirectUrl]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLocalDevAccess() {
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/session/dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        setError(resolveLocalDevError(locale, payload?.error));
        setPending(false);
        return;
      }

      window.location.replace(nextPath);
    } catch {
      setError(resolveLocalDevError(locale));
      setPending(false);
    }
  }

  return (
    <div className="auth-actions">
      <button
        type="button"
        className="secondary-button ghost-button"
        onClick={handleLocalDevAccess}
        disabled={pending}
      >
        {pending ? copy.pending : copy.action}
      </button>
      <p>{copy.hint}</p>
      {error ? <WorkspaceFeedback tone="danger">{error}</WorkspaceFeedback> : null}
    </div>
  );
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
    // Ignore invalid redirects and fall back to the project list.
  }

  return `/${locale}/projects`;
}

function getLocalDevAccessCopy(locale: SupportedLocale) {
  if (locale === 'en-US') {
    return {
      action: 'Enter Local Dev Workspace',
      pending: 'Opening Local Dev Workspace...',
      hint: 'Development-only shortcut. Creates a local session without Google sign-in.',
    };
  }

  return {
    action: '进入本地开发工作台',
    pending: '正在进入本地开发工作台...',
    hint: '仅用于本地开发调试。点击后会直接创建站内会话，不走 Google 登录。',
  };
}

function resolveLocalDevError(locale: SupportedLocale, code?: string) {
  if (code === 'DEV_AUTH_DISABLED') {
    return locale === 'en-US'
      ? 'The local development access entry is disabled.'
      : '本地开发入口尚未开启。';
  }

  return locale === 'en-US'
    ? 'Failed to enter the local development workspace. Please retry.'
    : '进入本地开发工作台失败，请重试。';
}

'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface LoginFormProps {
  locale: SupportedLocale;
  labels: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    displayName: string;
    action: string;
    helper: string;
    invalidCredentials: string;
  };
}

export function LoginForm({ locale, labels }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
        locale,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setSubmitting(false);
      setError(
        payload.error === 'INVALID_CREDENTIALS'
          ? labels.invalidCredentials
          : payload.error || labels.invalidCredentials
      );
      return;
    }

    startTransition(() => {
      router.push(`/${locale}/projects`);
      router.refresh();
    });
  }

  return (
    <div className="marketing-shell">
      <div className="auth-card">
        <h1>{labels.title}</h1>
        <p>{labels.subtitle}</p>
        <form className="stack-gap" onSubmit={handleSubmit}>
          <label className="field">
            <span>{labels.email}</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label className="field">
            <span>{labels.password}</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={6} />
          </label>
          <label className="field">
            <span>{labels.displayName}</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} type="text" />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? '...' : labels.action}
          </button>
        </form>
        <p className="helper-text">{labels.helper}</p>
      </div>
    </div>
  );
}

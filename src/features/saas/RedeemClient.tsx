'use client';

import { useState } from 'react';
import type { CreditLedgerEntry, SupportedLocale } from '@/server/shared/platform/domain';

interface RedeemClientProps {
  locale: SupportedLocale;
  ledgerEntries: CreditLedgerEntry[];
  labels: {
    title: string;
    subtitle: string;
    placeholder: string;
    action: string;
    history: string;
  };
}

export function RedeemClient({ locale, ledgerEntries, labels }: RedeemClientProps) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function handleRedeem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/redeem-codes/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    const payload = await response.json();
    setMessage(payload.ok ? 'Success' : payload.error);
    if (payload.ok) {
      setCode('');
    }
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <section className="workspace-hero">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
      </section>

      <section className="workspace-grid">
        <form className="card stack-gap" onSubmit={handleRedeem}>
          <label className="field">
            <span>{labels.action}</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={labels.placeholder} />
          </label>
          <button type="submit" className="primary-button">
            {labels.action}
          </button>
          {message ? <p className="helper-text">{message}</p> : null}
        </form>

        <article className="card stack-gap">
          <h2>{labels.history}</h2>
          {ledgerEntries
            .filter((entry) => entry.kind === 'redeem_code_grant')
            .map((entry) => (
              <div key={entry.id} className="list-row">
                <div>
                  <strong>{entry.note ?? entry.kind}</strong>
                  <p>{new Date(entry.createdAt).toLocaleString(locale)}</p>
                </div>
                <span>+{entry.deltaCredits}</span>
              </div>
            ))}
        </article>
      </section>
    </div>
  );
}

'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreditPackCatalogEntry, PlanCatalogEntry } from '@/server/billing/catalog';
import type { SupportedCurrency, SupportedLocale } from '@/server/shared/platform/domain';

interface PricingClientProps {
  locale: SupportedLocale;
  initialCurrency: SupportedCurrency;
  plans: PlanCatalogEntry[];
  creditPacks: CreditPackCatalogEntry[];
  labels: {
    title: string;
    subtitle: string;
    billingHint: string;
    packsTitle: string;
    manualHint: string;
    subscribe: string;
    buyCredits: string;
  };
}

export function PricingClient({
  locale,
  initialCurrency,
  plans,
  creditPacks,
  labels,
}: PricingClientProps) {
  const router = useRouter();
  const [currency, setCurrency] = useState<SupportedCurrency>(initialCurrency);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const localeKey = locale === 'en-US' ? 'en-US' : 'zh-CN';

  async function handleCheckout(payload: {
    purchaseKind: 'subscription' | 'credit-pack';
    planKey?: string;
    creditPackKey?: string;
  }) {
    const key = `${payload.purchaseKind}:${payload.planKey ?? payload.creditPackKey ?? 'unknown'}`;
    setBusyKey(key);
    const response = await fetch('/api/billing/checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        currency,
      }),
    });
    const result = await response.json();
    setBusyKey(null);

    if (result.checkout?.mode === 'stripe' && result.checkout?.url) {
      window.location.href = result.checkout.url;
      return;
    }

    startTransition(() => {
      router.push(`/${locale}/billing`);
      router.refresh();
    });
  }

  return (
    <div className="marketing-shell stack-gap-lg">
      <section className="hero-card">
        <span className="eyebrow">{labels.title}</span>
        <h1>{labels.subtitle}</h1>
        <p>{labels.billingHint}</p>
        <div className="segmented-control">
          {(['CNY', 'USD'] as SupportedCurrency[]).map((nextCurrency) => (
            <button
              key={nextCurrency}
              type="button"
              className={`segment ${currency === nextCurrency ? 'active' : ''}`}
              onClick={() => setCurrency(nextCurrency)}
            >
              {nextCurrency}
            </button>
          ))}
        </div>
      </section>

      <section className="pricing-grid">
        {plans.map((plan) => (
          <article key={plan.key} className="pricing-card">
            <h2>{plan.name[localeKey]}</h2>
            <p>{plan.description[localeKey]}</p>
            <strong className="price-tag">
              {formatMoney(plan.prices[currency].amountCents, currency)}
              <span>/mo</span>
            </strong>
            <p>{plan.monthlyCredits} credits / month</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => handleCheckout({ purchaseKind: 'subscription', planKey: plan.key })}
              disabled={busyKey === `subscription:${plan.key}`}
            >
              {labels.subscribe}
            </button>
          </article>
        ))}
      </section>

      <section className="stack-gap">
        <h2>{labels.packsTitle}</h2>
        <div className="pricing-grid compact">
          {creditPacks.map((pack) => (
            <article key={pack.key} className="pricing-card">
              <h3>{pack.credits} credits</h3>
              <strong className="price-tag">{formatMoney(pack.prices[currency].amountCents, currency)}</strong>
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleCheckout({ purchaseKind: 'credit-pack', creditPackKey: pack.key })}
                disabled={busyKey === `credit-pack:${pack.key}`}
              >
                {labels.buyCredits}
              </button>
            </article>
          ))}
        </div>
        <p className="helper-text">{labels.manualHint}</p>
      </section>
    </div>
  );
}

function formatMoney(amountCents: number, currency: SupportedCurrency): string {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreditPackCatalogEntry, PlanCatalogEntry } from '@/server/billing/catalog';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface PricingClientProps {
  locale: SupportedLocale;
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
  plans,
  creditPacks,
  labels,
}: PricingClientProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const currency = 'USD' as const;
  const localeKey = locale === 'en-US' ? 'en-US' : 'zh-CN';

  async function handleCheckout(payload: {
    purchaseKind: 'subscription' | 'credit-pack';
    planKey?: string;
    creditPackKey?: string;
    skipCheckout?: boolean;
  }) {
    if (payload.skipCheckout) {
      startTransition(() => {
        router.push(`/${locale}/projects`);
      });
      return;
    }

    const key = `${payload.purchaseKind}:${payload.planKey ?? payload.creditPackKey ?? 'unknown'}`;
    setBusyKey(key);
    setMessage(null);
    const response = await fetch(resolvePayPalPurchaseEndpoint(payload.purchaseKind), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(payload.purchaseKind === 'subscription'
          ? { planKey: payload.planKey, requestedCurrency: 'USD' }
          : { creditPackKey: payload.creditPackKey, requestedCurrency: 'USD' }),
      }),
    });
    const result = await response.json();
    setBusyKey(null);

    if (!response.ok || !result.ok) {
      if (response.status === 401) {
        startTransition(() => {
          router.push(`/${locale}/login`);
        });
        return;
      }

      setMessage(result.error ?? getDefaultPricingError(locale));
      return;
    }

    if (result.checkout?.url) {
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
        <p className="helper-text">{labels.manualHint}</p>
        {message ? <p className="error-message">{message}</p> : null}
      </section>

      <section className="pricing-grid">
        {plans.map((plan) => (
          <article key={plan.key} className="pricing-card">
            <div className="list-row">
              <h2>{plan.name[localeKey]}</h2>
              <span className="chip">PayPal</span>
            </div>
            <p>{plan.description[localeKey]}</p>
            <strong className="price-tag">
              {formatMoney(plan.prices[currency].amountCents, currency)}
              <span>/mo</span>
            </strong>
            <p>{plan.monthlyCredits} credits / month</p>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                handleCheckout({
                  purchaseKind: 'subscription',
                  planKey: plan.key,
                  skipCheckout: plan.prices[currency].amountCents === 0,
                })
              }
              disabled={busyKey === `subscription:${plan.key}`}
            >
              {plan.prices[currency].amountCents === 0 ? getFreePlanActionLabel(locale) : `${labels.subscribe} · PayPal`}
            </button>
          </article>
        ))}
      </section>

      <section className="stack-gap">
        <h2>{labels.packsTitle}</h2>
        <div className="pricing-grid compact">
          {creditPacks.map((pack) => (
            <article key={pack.key} className="pricing-card">
              <div className="list-row">
                <h3>{pack.credits} credits</h3>
                <span className="chip">PayPal</span>
              </div>
              <strong className="price-tag">{formatMoney(pack.prices[currency].amountCents, currency)}</strong>
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleCheckout({ purchaseKind: 'credit-pack', creditPackKey: pack.key })}
                disabled={busyKey === `credit-pack:${pack.key}`}
              >
                {`${labels.buyCredits} · PayPal`}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function getFreePlanActionLabel(locale: SupportedLocale) {
  return locale === 'en-US' ? 'Start free' : '开始免费使用';
}

function getDefaultPricingError(locale: SupportedLocale) {
  return locale === 'en-US' ? 'Unable to start checkout.' : '暂时无法发起结账。';
}

function resolvePayPalPurchaseEndpoint(purchaseKind: 'subscription' | 'credit-pack') {
  return purchaseKind === 'subscription'
    ? '/api/billing/paypal/create-subscription'
    : '/api/billing/paypal/create-order';
}

'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import type { CreditPackCatalogEntry, PlanCatalogEntry } from '@/server/billing/catalog';
import type { SupportedLocale } from '@/server/shared/platform/domain';
import { PayPalCreditPackButtons } from '@/features/saas/paypal/PayPalCreditPackButtons';

interface PricingClientProps {
  locale: SupportedLocale;
  plans: PlanCatalogEntry[];
  creditPacks: CreditPackCatalogEntry[];
  paypalClientId: string | null;
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
  paypalClientId,
  labels,
}: PricingClientProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [payPalSdkReady, setPayPalSdkReady] = useState(false);
  const [payPalSdkFailed, setPayPalSdkFailed] = useState(false);
  const currency = 'USD' as const;
  const localeKey = locale === 'en-US' ? 'en-US' : 'zh-CN';
  const packHighlights = getPackHighlights(locale);

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

    if (result.checkout?.approvalUrl) {
      window.location.href = result.checkout.approvalUrl;
      return;
    }

    startTransition(() => {
      router.push(`/${locale}/billing`);
      router.refresh();
    });
  }

  return (
    <div className="marketing-shell stack-gap-lg">
      {paypalClientId ? (
        <Script
          id="paypal-js-sdk"
          src={`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD&intent=capture&components=buttons`}
          strategy="afterInteractive"
          onReady={() => {
            setPayPalSdkReady(true);
            setPayPalSdkFailed(false);
          }}
          onError={() => {
            setPayPalSdkReady(false);
            setPayPalSdkFailed(true);
          }}
        />
      ) : null}

      <section className="hero-card pricing-hero">
        <div className="pricing-hero-copy">
          <span className="eyebrow">{labels.title}</span>
          <h1>{labels.subtitle}</h1>
          <p>{labels.billingHint}</p>
          <p className="helper-text">{labels.manualHint}</p>
        </div>
        <div className="pricing-hero-panel">
          <div className="metric-card metric-card-matcha">
            <span>{locale === 'en-US' ? 'Plans' : '套餐'}</span>
            <strong>{plans.length}</strong>
          </div>
          <div className="metric-card metric-card-lemon">
            <span>{locale === 'en-US' ? 'Creator' : '创作者版'}</span>
            <strong>{formatMoney(plans[1]?.prices[currency].amountCents ?? 0, currency)}</strong>
          </div>
          <div className="metric-card metric-card-slushie">
            <span>PayPal</span>
            <strong>{locale === 'en-US' ? 'Live checkout' : '在线结账'}</strong>
          </div>
        </div>
        <div className="pricing-hero-ribbon">
          <span>{locale === 'en-US' ? 'Warm, flexible plans for adaptation workflows.' : '为短剧改编流程准备的温暖、灵活的套餐组合。'}</span>
        </div>
        {message ? <p className="error-message">{message}</p> : null}
      </section>

      <section className="pricing-grid">
        {plans.map((plan, index) => (
          <article
            key={plan.key}
            className={`pricing-card pricing-plan-card pricing-tone-${resolvePlanTone(index)} ${plan.key === 'creator' ? 'pricing-card-featured' : ''}`}
          >
            <div className="list-row">
              <div className="stack-gap-sm">
                <h2>{plan.name[localeKey]}</h2>
                <p>{plan.description[localeKey]}</p>
              </div>
              <span className="chip">{plan.key === 'creator' ? (locale === 'en-US' ? 'Popular' : '主推') : 'PayPal'}</span>
            </div>
            <strong className="price-tag">
              {formatMoney(plan.prices[currency].amountCents, currency)}
              <span>/mo</span>
            </strong>
            <p className="pricing-credit-note">{plan.monthlyCredits} credits / month</p>
            <ul className="feature-list">
              {resolvePlanHighlights(locale, plan.monthlyCredits).map((item) => (
                <li key={`${plan.key}-${item}`}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className={plan.key === 'creator' ? 'primary-button' : 'secondary-button'}
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

      <section className="stack-gap pricing-packs-shell">
        <div className="list-row pricing-packs-header">
          <div className="stack-gap-sm">
            <span className="eyebrow">{labels.packsTitle}</span>
            <h2>{locale === 'en-US' ? 'Top up only when a sprint needs extra fuel.' : '只在冲刺阶段，为创作流程额外补充燃料。'}</h2>
          </div>
          <p className="helper-text">
            {locale === 'en-US'
              ? 'Use packs for burst generation, extra revisions, and export-heavy delivery days.'
              : '积分加包适合集中生成、额外修改和导出密集的交付日。'}
          </p>
        </div>
        <div className="pricing-grid compact">
          {creditPacks.map((pack, index) => (
            <article key={pack.key} className={`pricing-card pricing-pack-card pricing-tone-${resolvePackTone(index)}`}>
              <div className="list-row">
                <div className="stack-gap-sm">
                  <h3>{pack.credits} credits</h3>
                  <p>{packHighlights[pack.key] ?? labels.buyCredits}</p>
                </div>
                <span className="chip">PayPal</span>
              </div>
              <strong className="price-tag">{formatMoney(pack.prices[currency].amountCents, currency)}</strong>
              {paypalClientId && !payPalSdkFailed ? (
                <div className="stack-gap-sm">
                  {!payPalSdkReady ? (
                    <button type="button" className="secondary-button" disabled>
                      {`${labels.buyCredits} · PayPal`}
                    </button>
                  ) : (
                    <PayPalCreditPackButtons
                      creditPackKey={pack.key}
                      sdkReady={payPalSdkReady}
                      onRequireLogin={() => {
                        startTransition(() => {
                          router.push(`/${locale}/login`);
                        });
                      }}
                      onError={(error) => {
                        setMessage(resolvePayPalButtonError(locale, error));
                      }}
                      onSuccess={() => {
                        startTransition(() => {
                          router.push(`/${locale}/billing?checkout=success&purchaseKind=credit-pack`);
                          router.refresh();
                        });
                      }}
                    />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleCheckout({ purchaseKind: 'credit-pack', creditPackKey: pack.key })}
                  disabled={busyKey === `credit-pack:${pack.key}`}
                >
                  {`${labels.buyCredits} · PayPal`}
                </button>
              )}
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

function resolvePayPalButtonError(locale: SupportedLocale, error: string) {
  if (error === 'PAYPAL_CHECKOUT_CANCELLED') {
    return locale === 'en-US' ? 'PayPal checkout was cancelled.' : 'PayPal 结账已取消。';
  }

  return locale === 'en-US' ? 'Unable to complete PayPal checkout.' : '暂时无法完成 PayPal 结账。';
}

function resolvePayPalPurchaseEndpoint(purchaseKind: 'subscription' | 'credit-pack') {
  return purchaseKind === 'subscription'
    ? '/api/billing/paypal/create-subscription'
    : '/api/billing/paypal/create-order';
}

function resolvePlanTone(index: number) {
  return ['paper', 'matcha', 'blueberry'][index] ?? 'paper';
}

function resolvePackTone(index: number) {
  return ['lemon', 'slushie', 'ube'][index] ?? 'paper';
}

function resolvePlanHighlights(locale: SupportedLocale, monthlyCredits: number): string[] {
  if (locale === 'en-US') {
    return [
      `${monthlyCredits} monthly credits included`,
      'Project workflow and billing linked together',
      'PayPal redirect checkout with live sync',
    ];
  }

  return [
    `每月包含 ${monthlyCredits} 积分`,
    '项目、账单、生成流程统一管理',
    'PayPal 跳转支付后自动同步状态',
  ];
}

function getPackHighlights(locale: SupportedLocale): Record<string, string> {
  if (locale === 'en-US') {
    return {
      'credits-50': 'For targeted rewrites and quick fixes.',
      'credits-200': 'For burst production and fast iteration.',
      'credits-500': 'For launch weeks and parallel project pushes.',
    };
  }

  return {
    'credits-50': '适合做定向补写和快速修正。',
    'credits-200': '适合集中生成和快速迭代。',
    'credits-500': '适合上线周和多个项目并行推进。',
  };
}

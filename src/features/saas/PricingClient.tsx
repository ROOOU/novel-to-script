'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import {
  WorkspaceCapabilityCard,
  WorkspaceFeedback,
  WorkspaceHero,
  WorkspaceListRow,
  WorkspaceMetricCard,
} from '@/components/WorkspaceUI';
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
  const creatorPlan = plans.find((plan) => plan.key === 'creator') ?? plans[0] ?? null;
  const lastPlan = plans[plans.length - 1] ?? null;
  const overviewCards =
    locale === 'en-US'
      ? [
          {
            badge: 'Plans',
            eyebrow: 'Subscription',
            title: 'Choose a baseline that matches your production tempo',
            description: 'Plans establish the default credit rhythm for a team or solo creator before extra top-ups are needed.',
            tone: 'delivery',
            meta: [
              { label: 'Tiers', value: `${plans.length}` },
              { label: 'Featured', value: creatorPlan?.name[localeKey] ?? 'Creator' },
              { label: 'Range', value: `${formatMoney(plans[0]?.prices[currency].amountCents ?? 0, currency)} - ${formatMoney(lastPlan?.prices[currency].amountCents ?? 0, currency)}` },
            ],
          },
          {
            badge: 'Credits',
            eyebrow: 'Capacity',
            title: 'Match monthly credits to iteration pressure',
            description: 'Credit ladders help teams decide whether they need steady drafting volume or occasional burst support.',
            tone: 'source',
            meta: [
              { label: 'Creator plan', value: `${creatorPlan?.monthlyCredits ?? 0} / mo` },
              { label: 'Top-up packs', value: `${creditPacks.length}` },
              { label: 'Checkout', value: 'PayPal synced' },
            ],
          },
          {
            badge: 'Checkout',
            eyebrow: 'PayPal',
            title: 'Subscriptions and top-ups share one checkout path',
            description: 'Whether someone starts a plan or buys extra credits, the purchase lands back in the same billing summary.',
            tone: 'script',
            meta: [
              { label: 'Flow', value: 'Subscription + packs' },
              { label: 'Status', value: resolvePayPalStatus(locale, paypalClientId, payPalSdkReady, payPalSdkFailed) },
              { label: 'Currency', value: currency },
            ],
          },
          {
            badge: 'Delivery',
            eyebrow: 'Studio',
            title: 'Pricing is tied to the real production workflow',
            description: 'Credits are there to support source intake, script drafting, storyboard prompt packs, and export-heavy delivery days.',
            tone: 'storyboard',
            meta: [
              { label: 'Supports', value: 'Script + storyboard' },
              { label: 'Prompting', value: 'Seedance ready' },
              { label: 'After checkout', value: 'Billing sync' },
            ],
          },
        ]
      : [
          {
            badge: '套餐',
            eyebrow: '订阅',
            title: '先选一条适合当前产能的基线',
            description: '套餐决定团队或个人创作者的默认积分节奏，额外加包只是对冲刺阶段的补充。',
            tone: 'delivery',
            meta: [
              { label: '梯度', value: `${plans.length} 档` },
              { label: '主推', value: creatorPlan?.name[localeKey] ?? 'Creator' },
              { label: '范围', value: `${formatMoney(plans[0]?.prices[currency].amountCents ?? 0, currency)} - ${formatMoney(lastPlan?.prices[currency].amountCents ?? 0, currency)}` },
            ],
          },
          {
            badge: '积分',
            eyebrow: '容量',
            title: '按月度节奏决定基础积分',
            description: '积分梯度帮助判断你需要稳定的日常生成，还是更多应对集中冲刺的余量。',
            tone: 'source',
            meta: [
              { label: 'Creator', value: `${creatorPlan?.monthlyCredits ?? 0} / 月` },
              { label: '补充包', value: `${creditPacks.length} 个` },
              { label: '结账', value: 'PayPal 同步' },
            ],
          },
          {
            badge: '支付',
            eyebrow: 'PayPal',
            title: '订阅和加包共用同一条支付路径',
            description: '无论是开通套餐还是补充积分，支付完成后都会回到同一个账单中心沉淀记录。',
            tone: 'script',
            meta: [
              { label: '路径', value: '订阅 + 积分包' },
              { label: '状态', value: resolvePayPalStatus(locale, paypalClientId, payPalSdkReady, payPalSdkFailed) },
              { label: '币种', value: currency },
            ],
          },
          {
            badge: '流程',
            eyebrow: '工作台',
            title: '套餐服务的是完整生产流程',
            description: '积分会真正用在原文录入、剧本生成、分镜提示词包和导出密集的交付阶段。',
            tone: 'storyboard',
            meta: [
              { label: '覆盖', value: '剧本 + 分镜' },
              { label: '提示词', value: 'Seedance 可用' },
              { label: '支付后', value: '账单自动同步' },
            ],
          },
        ];

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
      window.location.assign(result.checkout.approvalUrl);
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

      <WorkspaceHero
        variant="pricing"
        eyebrow={labels.title}
        title={labels.subtitle}
        description={labels.billingHint}
        afterDescription={<p className="helper-text">{labels.manualHint}</p>}
        tags={[
          <span key="plans" className="chip chip-count">
            {locale === 'en-US' ? `${plans.length} plan tiers` : `${plans.length} 档套餐`}
          </span>,
          <span key="packs" className="chip chip-soft">
            {locale === 'en-US' ? `${creditPacks.length} credit packs` : `${creditPacks.length} 个积分包`}
          </span>,
          <span key="flow" className="chip">
            {locale === 'en-US' ? 'Subscription + top-up' : '订阅 + 加包'}
          </span>,
        ]}
        aside={
          <>
            <WorkspaceMetricCard
              tone="matcha"
              label={locale === 'en-US' ? 'Plans' : '套餐'}
              value={plans.length}
            />
            <WorkspaceMetricCard
              tone="lemon"
              label={locale === 'en-US' ? 'Creator' : '创作者版'}
              value={formatMoney(creatorPlan?.prices[currency].amountCents ?? 0, currency)}
            />
            <WorkspaceMetricCard
              tone="slushie"
              label="PayPal"
              value={resolvePayPalStatus(locale, paypalClientId, payPalSdkReady, payPalSdkFailed)}
            />
          </>
        }
        footer={
          <>
            <div className="pricing-hero-ribbon">
              <span>
                {locale === 'en-US'
                  ? 'Warm, flexible plans for adaptation workflows.'
                  : '为短剧改编流程准备的温暖、灵活的套餐组合。'}
              </span>
            </div>
            {message ? <WorkspaceFeedback tone="danger">{message}</WorkspaceFeedback> : null}
          </>
        }
      />

      <section className="workspace-capability-grid">
        {overviewCards.map((card) => (
          <WorkspaceCapabilityCard
            key={`${card.badge}-${card.tone}`}
            tone={card.tone}
            eyebrow={card.eyebrow}
            title={card.title}
            badge={card.badge}
            description={card.description}
            meta={card.meta.map((item) => ({
              key: `${card.badge}-${item.label}`,
              label: item.label,
              value: item.value,
            }))}
          />
        ))}
      </section>

      <section className="pricing-grid">
        {plans.map((plan, index) => (
          <article
            key={plan.key}
            className={`pricing-card pricing-plan-card pricing-tone-${resolvePlanTone(index)} ${plan.key === 'creator' ? 'pricing-card-featured' : ''}`}
          >
            <WorkspaceListRow>
              <div className="stack-gap-sm">
                <h2>{plan.name[localeKey]}</h2>
                <p>{plan.description[localeKey]}</p>
              </div>
              <span className="chip">{plan.key === 'creator' ? (locale === 'en-US' ? 'Popular' : '主推') : 'PayPal'}</span>
            </WorkspaceListRow>
            <strong className="price-tag">
              {formatMoney(plan.prices[currency].amountCents, currency)}
              <span>{resolvePriceCycleLabel(locale, plan.prices[currency].amountCents === 0)}</span>
            </strong>
            <p className="pricing-credit-note">{resolveCreditAllowanceLabel(locale, plan.monthlyCredits)}</p>
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
        <WorkspaceListRow className="pricing-packs-header">
          <div className="stack-gap-sm">
            <span className="eyebrow">{labels.packsTitle}</span>
            <h2>{locale === 'en-US' ? 'Top up only when a sprint needs extra fuel.' : '只在冲刺阶段，为创作流程额外补充燃料。'}</h2>
          </div>
          <p className="helper-text">
            {locale === 'en-US'
              ? 'Use packs for burst generation, extra revisions, and export-heavy delivery days.'
              : '积分加包适合集中生成、额外修改和导出密集的交付日。'}
          </p>
        </WorkspaceListRow>
        <div className="pricing-grid compact">
          {creditPacks.map((pack, index) => (
            <article key={pack.key} className={`pricing-card pricing-pack-card pricing-tone-${resolvePackTone(index)}`}>
              <WorkspaceListRow>
                <div className="stack-gap-sm">
                  <h3>{pack.credits} credits</h3>
                  <p>{packHighlights[pack.key] ?? labels.buyCredits}</p>
                </div>
                <span className="chip">PayPal</span>
              </WorkspaceListRow>
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

function resolvePayPalStatus(
  locale: SupportedLocale,
  paypalClientId: string | null,
  payPalSdkReady: boolean,
  payPalSdkFailed: boolean
) {
  if (!paypalClientId) {
    return locale === 'en-US' ? 'Manual fallback' : '手动回退';
  }

  if (payPalSdkFailed) {
    return locale === 'en-US' ? 'SDK retry needed' : 'SDK 需重试';
  }

  if (payPalSdkReady) {
    return locale === 'en-US' ? 'Live checkout' : '在线结账';
  }

  return locale === 'en-US' ? 'SDK loading' : 'SDK 加载中';
}

function resolvePriceCycleLabel(locale: SupportedLocale, isFree: boolean) {
  if (isFree) {
    return locale === 'en-US' ? '/start' : '/起步';
  }

  return locale === 'en-US' ? '/mo' : '/月';
}

function resolveCreditAllowanceLabel(locale: SupportedLocale, monthlyCredits: number) {
  return locale === 'en-US'
    ? `${monthlyCredits} credits / month`
    : `每月包含 ${monthlyCredits} 积分`;
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

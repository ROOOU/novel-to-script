'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WorkspaceCapabilityCard,
  WorkspaceFeedback,
  WorkspaceHero,
  WorkspaceListRow,
  WorkspaceListRowMeta,
  WorkspaceMetricCard,
  WorkspaceMiniList,
  WorkspaceNoteCard,
  WorkspaceStatusPill,
} from '@/components/WorkspaceUI';
import type {
  CreditAccount,
  CreditLedgerEntry,
  GenerationJobKind,
  PaymentOrder,
  Subscription,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import type { BillingUsageSummary } from '@/server/billing/usage';

interface BillingClientProps {
  locale: SupportedLocale;
  subscription: Subscription | null;
  creditAccount: CreditAccount | null;
  paymentOrders: PaymentOrder[];
  ledgerEntries: CreditLedgerEntry[];
  usage: BillingUsageSummary;
  initialCheckout?: {
    status?: 'success' | 'cancelled' | null;
    paymentOrderId?: string | null;
    providerOrderId?: string | null;
    purchaseKind?: 'subscription' | 'credit-pack' | null;
  };
  labels: {
    title: string;
    subtitle: string;
    currentPlan: string;
    creditsBalance: string;
    reservedCredits: string;
    grantedTotal: string;
    consumedTotal: string;
    orders: string;
    noOrders: string;
    creditActivity: string;
    noCreditActivity: string;
    usageTitle: string;
    usageSubtitle: string;
    usageThisMonth: string;
    usageByProject: string;
    usageByTaskType: string;
    usageEmpty: string;
    usageShare: string;
    usageCreditsUnit: string;
    usageJobs: string;
    unknownProject: string;
    taskTypeScriptGeneration: string;
    taskTypeStoryboardGeneration: string;
    taskTypeExportGeneration: string;
    taskTypeAnalysisGeneration: string;
    openPortal: string;
    manualMessage: string;
  };
}

export function BillingClient({
  locale,
  subscription: initialSubscription,
  creditAccount: initialCreditAccount,
  paymentOrders: initialPaymentOrders,
  ledgerEntries: initialLedgerEntries,
  usage: initialUsage,
  initialCheckout,
  labels,
}: BillingClientProps) {
  const [subscription, setSubscription] = useState(initialSubscription);
  const [creditAccount, setCreditAccount] = useState(initialCreditAccount);
  const [paymentOrders, setPaymentOrders] = useState(initialPaymentOrders);
  const [ledgerEntries, setLedgerEntries] = useState(initialLedgerEntries);
  const [usage, setUsage] = useState(initialUsage);
  const [checkoutNotice, setCheckoutNotice] = useState<{
    tone: 'success' | 'running' | 'danger' | 'muted';
    message: string;
  } | null>(() => {
    if (initialCheckout?.status === 'cancelled') {
      return {
        tone: 'muted',
        message: locale === 'en-US' ? 'PayPal checkout was cancelled.' : 'PayPal 结账已取消。',
      };
    }

    return null;
  });
  const handledCheckoutRef = useRef(false);
  const usageJobCount = usage.byTaskType.reduce((total, entry) => total + entry.jobCount, 0);
  const latestOrder =
    [...paymentOrders].sort(
      (left, right) =>
        new Date(right.paidAt ?? right.createdAt).getTime() - new Date(left.paidAt ?? left.createdAt).getTime()
    )[0] ?? null;
  const overviewCards =
    locale === 'en-US'
      ? [
          {
            badge: 'Plan',
            eyebrow: 'Subscription',
            title: 'Keep plan state visible before usage details',
            description: 'Billing works best when plan, provider, and cadence can be checked without digging into orders.',
            tone: 'delivery',
            meta: [
              { label: 'Status', value: formatEnumLabel(subscription?.status ?? 'active') },
              { label: 'Interval', value: formatBillingIntervalLabel(locale, subscription?.billingInterval) },
              { label: 'Provider', value: (subscription?.provider ?? 'paypal').toUpperCase() },
            ],
          },
          {
            badge: 'Credits',
            eyebrow: 'Balance',
            title: 'Track available, reserved, and lifetime movement',
            description: 'The credit account should read like a production ledger, not a black box.',
            tone: 'source',
            meta: [
              { label: 'Available', value: `${creditAccount?.availableCredits ?? 0}` },
              { label: 'Reserved', value: `${creditAccount?.reservedCredits ?? 0}` },
              { label: 'Consumed', value: `${creditAccount?.consumedCreditsTotal ?? 0}` },
            ],
          },
          {
            badge: 'Usage',
            eyebrow: 'This month',
            title: 'See which projects and tasks used the budget',
            description: 'Usage is easier to trust when credits, jobs, and project spread are surfaced together.',
            tone: 'script',
            meta: [
              { label: 'Consumed', value: formatUsageCredits(locale, usage.totalCreditsConsumed, labels.usageCreditsUnit) },
              { label: 'Projects', value: `${usage.byProject.length}` },
              { label: 'Jobs', value: `${usageJobCount}` },
            ],
          },
          {
            badge: 'Orders',
            eyebrow: 'Payments',
            title: 'Keep the last payment in the same summary layer',
            description: 'The newest order should be glanceable before someone needs the deeper ledger below.',
            tone: 'storyboard',
            meta: [
              { label: 'Latest', value: latestOrder ? formatEnumLabel(latestOrder.status) : 'No orders yet' },
              { label: 'Amount', value: latestOrder ? formatOrderAmount(locale, latestOrder) : '-' },
              { label: 'Paid at', value: formatBillingDate(locale, latestOrder?.paidAt ?? latestOrder?.createdAt) },
            ],
          },
        ]
      : [
          {
            badge: '计划',
            eyebrow: '订阅',
            title: '先把计划状态放到最前面',
            description: '订阅方案、提供方和计费周期应该先看见，再进入订单和流水细节。',
            tone: 'delivery',
            meta: [
              { label: '状态', value: formatEnumLabel(subscription?.status ?? 'active') },
              { label: '周期', value: formatBillingIntervalLabel(locale, subscription?.billingInterval) },
              { label: '渠道', value: (subscription?.provider ?? 'paypal').toUpperCase() },
            ],
          },
          {
            badge: '积分',
            eyebrow: '余额',
            title: '把可用、预留和累计变化拆开看',
            description: '积分账户更像一张生产流水表，余额、预留和累计消耗需要同时可追踪。',
            tone: 'source',
            meta: [
              { label: '可用', value: `${creditAccount?.availableCredits ?? 0}` },
              { label: '预留', value: `${creditAccount?.reservedCredits ?? 0}` },
              { label: '累计消耗', value: `${creditAccount?.consumedCreditsTotal ?? 0}` },
            ],
          },
          {
            badge: '用量',
            eyebrow: '本月',
            title: '直接看到积分花在什么地方',
            description: '把本月积分、任务数和涉及项目一起摆出来，消耗去向会更清楚。',
            tone: 'script',
            meta: [
              { label: '已消耗', value: formatUsageCredits(locale, usage.totalCreditsConsumed, labels.usageCreditsUnit) },
              { label: '项目', value: `${usage.byProject.length}` },
              { label: '任务', value: `${usageJobCount}` },
            ],
          },
          {
            badge: '订单',
            eyebrow: '支付',
            title: '最近一笔支付放在同一层摘要里',
            description: '先快速确认最近订单状态、金额和到账时间，再往下看完整流水。',
            tone: 'storyboard',
            meta: [
              { label: '最近状态', value: latestOrder ? formatEnumLabel(latestOrder.status) : '暂无订单' },
              { label: '金额', value: latestOrder ? formatOrderAmount(locale, latestOrder) : '-' },
              { label: '时间', value: formatBillingDate(locale, latestOrder?.paidAt ?? latestOrder?.createdAt) },
            ],
          },
        ];

  const reconcileCheckout = useCallback(async () => {
    if (
      initialCheckout?.purchaseKind === 'credit-pack' &&
      (initialCheckout.paymentOrderId || initialCheckout.providerOrderId)
    ) {
      setCheckoutNotice({
        tone: 'running',
        message:
          locale === 'en-US'
            ? 'Confirming your PayPal payment and refreshing credits...'
            : '正在确认 PayPal 支付并刷新积分...',
      });

      const captureResponse = await fetch('/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          initialCheckout.paymentOrderId
            ? { paymentOrderId: initialCheckout.paymentOrderId }
            : { providerOrderId: initialCheckout.providerOrderId }
        ),
      });
      const capturePayload = await captureResponse.json();

      if (!captureResponse.ok || !capturePayload.ok) {
        setCheckoutNotice({
          tone: 'danger',
          message:
            capturePayload.error ??
            (locale === 'en-US' ? 'Unable to confirm PayPal payment.' : '暂时无法确认 PayPal 支付。'),
        });
        clearCheckoutQuery();
        return;
      }
    }

    const summaryResponse = await fetch('/api/billing/summary');
    const summaryPayload = await summaryResponse.json();

    if (!summaryResponse.ok || !summaryPayload.ok) {
      setCheckoutNotice({
        tone: 'danger',
        message: locale === 'en-US' ? 'Unable to refresh billing summary.' : '暂时无法刷新账单摘要。',
      });
      clearCheckoutQuery();
      return;
    }

    setSubscription(summaryPayload.subscription ?? null);
    setCreditAccount(summaryPayload.creditAccount ?? null);
    setPaymentOrders(summaryPayload.paymentOrders ?? []);
    setLedgerEntries(summaryPayload.ledgerEntries ?? []);

    const usageResponse = await fetch('/api/billing/usage');
    if (usageResponse.ok) {
      const usagePayload = await usageResponse.json();
      if (usagePayload?.ok && usagePayload.usage) {
        setUsage(usagePayload.usage);
      }
    }

    setCheckoutNotice({
      tone: 'success',
      message:
        initialCheckout?.purchaseKind === 'subscription'
          ? locale === 'en-US'
            ? 'PayPal subscription is active.'
            : 'PayPal 订阅已生效。'
          : locale === 'en-US'
            ? 'PayPal payment completed. Credits are available now.'
            : 'PayPal 支付完成，积分已到账。',
    });
    clearCheckoutQuery();
  }, [initialCheckout, locale]);

  useEffect(() => {
    if (!initialCheckout?.status || handledCheckoutRef.current) {
      return;
    }

    handledCheckoutRef.current = true;

    if (initialCheckout.status === 'cancelled') {
      clearCheckoutQuery();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void reconcileCheckout();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialCheckout, reconcileCheckout]);

  return (
    <div className="workspace-shell stack-gap-lg">
      <WorkspaceHero
        className="billing-hero"
        eyebrow={locale === 'en-US' ? 'Billing' : '账单'}
        title={labels.title}
        description={labels.subtitle}
        tags={[
          <span key="plan" className="chip chip-count">
            {formatPlanLabel(subscription?.planKey)}
          </span>,
          <span key="projects" className="chip chip-soft">
            {locale === 'en-US'
              ? `${usage.byProject.length} active projects`
              : `${usage.byProject.length} 个项目有消耗`}
          </span>,
          latestOrder ? (
            <span key="latest" className="chip">
              {locale === 'en-US'
                ? `Latest payment ${formatBillingDate(locale, latestOrder.paidAt ?? latestOrder.createdAt)}`
                : `最近支付 ${formatBillingDate(locale, latestOrder.paidAt ?? latestOrder.createdAt)}`}
            </span>
          ) : null,
        ].filter(Boolean)}
        aside={
          <>
            <WorkspaceMetricCard
              tone="matcha"
              label={locale === 'en-US' ? 'Available' : '可用积分'}
              value={creditAccount?.availableCredits ?? 0}
            />
            <WorkspaceMetricCard
              tone="blueberry"
              label={locale === 'en-US' ? 'Plan' : '方案'}
              value={formatPlanLabel(subscription?.planKey)}
            />
            <WorkspaceMetricCard
              tone="slushie"
              label={labels.usageThisMonth}
              value={formatUsageCredits(locale, usage.totalCreditsConsumed, labels.usageCreditsUnit)}
            />
          </>
        }
      />

      {checkoutNotice ? (
        <WorkspaceFeedback tone={checkoutNotice.tone} title="PayPal">
          {checkoutNotice.message}
        </WorkspaceFeedback>
      ) : null}

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

      <section className="workspace-grid">
        <article className="card stack-gap billing-usage-card">
          <WorkspaceListRow>
            <div className="stack-gap-sm">
              <h2>{labels.usageTitle}</h2>
              <p className="helper-text">{labels.usageSubtitle}</p>
            </div>
            <WorkspaceListRowMeta>
              <span>{labels.usageThisMonth}</span>
              <strong>{formatUsageCredits(locale, usage.totalCreditsConsumed, labels.usageCreditsUnit)}</strong>
            </WorkspaceListRowMeta>
          </WorkspaceListRow>

          {usage.totalCreditsConsumed === 0 ? (
            <p className="helper-text">{labels.usageEmpty}</p>
          ) : (
            <div className="billing-usage-layout">
              <section className="billing-usage-section">
                <h3>{labels.usageByProject}</h3>
                <div className="billing-usage-list">
                  {usage.byProject.map((entry) => (
                    <div key={entry.projectId} className="billing-usage-item">
                      <div className="billing-usage-item-head">
                        <strong>{entry.projectName || labels.unknownProject}</strong>
                        <span>{formatUsageCredits(locale, entry.creditsConsumed, labels.usageCreditsUnit)}</span>
                      </div>
                      <div className="billing-usage-bar">
                        <div
                          className="billing-usage-bar-fill"
                          style={{
                            width: `${Math.max(entry.share * 100, entry.share > 0 ? 6 : 0)}%`,
                          }}
                        />
                      </div>
                      <div className="billing-usage-item-meta">
                        <span>{formatUsageJobs(locale, entry.jobCount, labels.usageJobs)}</span>
                        <span>{formatUsageShare(locale, entry.share, labels.usageShare)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="billing-usage-section">
                <h3>{labels.usageByTaskType}</h3>
                <div className="billing-usage-list">
                  {usage.byTaskType.map((entry) => (
                    <div key={entry.jobKind} className="billing-usage-item">
                      <div className="billing-usage-item-head">
                        <strong>{resolveTaskTypeLabel(entry.jobKind, labels)}</strong>
                        <span>{formatUsageCredits(locale, entry.creditsConsumed, labels.usageCreditsUnit)}</span>
                      </div>
                      <div className="billing-usage-bar">
                        <div
                          className="billing-usage-bar-fill"
                          style={{
                            width: `${Math.max(entry.share * 100, entry.share > 0 ? 6 : 0)}%`,
                          }}
                        />
                      </div>
                      <div className="billing-usage-item-meta">
                        <span>{formatUsageJobs(locale, entry.jobCount, labels.usageJobs)}</span>
                        <span>{formatUsageShare(locale, entry.share, labels.usageShare)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </article>

        <WorkspaceNoteCard
          tone="lemon"
          eyebrow={locale === 'en-US' ? 'Plan ledger' : '计划概览'}
          title={formatPlanLabel(subscription?.planKey)}
          description={
            locale === 'en-US'
              ? `${formatEnumLabel(subscription?.status ?? 'active')} via ${(subscription?.provider ?? 'paypal').toUpperCase()}`
              : `${formatEnumLabel(subscription?.status ?? 'active')} · ${(subscription?.provider ?? 'paypal').toUpperCase()}`
          }
          className="stack-gap billing-summary-card"
        >
          <WorkspaceMiniList
            items={[
              {
                key: 'available',
                label: labels.creditsBalance,
                value: creditAccount?.availableCredits ?? 0,
              },
              {
                key: 'reserved',
                label: labels.reservedCredits,
                value: creditAccount?.reservedCredits ?? 0,
              },
              {
                key: 'granted',
                label: labels.grantedTotal,
                value: creditAccount?.grantedCreditsTotal ?? 0,
              },
              {
                key: 'consumed',
                label: labels.consumedTotal,
                value: creditAccount?.consumedCreditsTotal ?? 0,
              },
            ]}
          />
          <div className="stack-gap-sm">
            <p className="helper-text">{`${labels.openPortal}: ${(subscription?.provider ?? 'paypal').toUpperCase()}`}</p>
            <p className="helper-text">{labels.manualMessage}</p>
          </div>
        </WorkspaceNoteCard>

        <article className="card stack-gap">
          <h2>{labels.orders}</h2>
          <div className="stack-gap">
            {paymentOrders.map((order) => (
              <WorkspaceListRow key={order.id}>
                <div>
                  <strong>{formatPurchaseKindLabel(locale, order.purchaseKind)}</strong>
                  <p>{order.planKey ?? order.creditPackKey ?? order.id}</p>
                  <p className="helper-text">{order.providerOrderId ?? order.id}</p>
                </div>
                <WorkspaceListRowMeta>
                  <WorkspaceStatusPill tone={resolveBillingStatusTone(order.status)}>
                    {formatEnumLabel(order.status)}
                  </WorkspaceStatusPill>
                  <span>{formatOrderAmount(locale, order)}</span>
                </WorkspaceListRowMeta>
              </WorkspaceListRow>
            ))}
            {paymentOrders.length === 0 ? <p className="helper-text">{labels.noOrders}</p> : null}
          </div>
        </article>

        <article className="card stack-gap">
          <h2>{labels.creditActivity}</h2>
          <div className="stack-gap">
            {ledgerEntries.slice(0, 6).map((entry) => (
              <WorkspaceListRow key={entry.id}>
                <div>
                  <strong>{entry.kind}</strong>
                  <p>{entry.note ?? (locale === 'en-US' ? 'No note' : '无备注')}</p>
                </div>
                <WorkspaceListRowMeta>
                  <WorkspaceStatusPill tone={resolveLedgerDeltaTone(entry.deltaCredits)}>
                    {entry.deltaCredits > 0 ? `+${entry.deltaCredits}` : entry.deltaCredits}
                  </WorkspaceStatusPill>
                  <span>{entry.balanceAfter}</span>
                </WorkspaceListRowMeta>
              </WorkspaceListRow>
            ))}
            {ledgerEntries.length === 0 ? <p className="helper-text">{labels.noCreditActivity}</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function clearCheckoutQuery() {
  if (typeof window === 'undefined') {
    return;
  }

  window.history.replaceState({}, '', window.location.pathname);
}

function formatUsageCredits(locale: SupportedLocale, value: number, unit: string) {
  const formatted = new Intl.NumberFormat(locale).format(value);
  return `${formatted} ${unit}`;
}

function formatUsageJobs(locale: SupportedLocale, value: number, label: string) {
  const formatted = new Intl.NumberFormat(locale).format(value);
  return `${label}: ${formatted}`;
}

function formatUsageShare(locale: SupportedLocale, share: number, label: string) {
  const percentage = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(share);
  return `${label}: ${percentage}`;
}

function formatBillingIntervalLabel(locale: SupportedLocale, interval?: Subscription['billingInterval'] | null) {
  if (!interval) {
    return locale === 'en-US' ? 'Monthly' : '月付';
  }

  if (interval === 'annual') {
    return locale === 'en-US' ? 'Annual' : '年付';
  }

  return locale === 'en-US' ? 'Monthly' : '月付';
}

function formatBillingDate(locale: SupportedLocale, value?: string | null) {
  if (!value) {
    return locale === 'en-US' ? 'Not available' : '暂无';
  }

  return new Date(value).toLocaleDateString(locale);
}

function formatEnumLabel(value: string) {
  return value.replace(/[-_]/g, ' ');
}

function formatPlanLabel(planKey?: string | null) {
  if (!planKey) {
    return 'free';
  }

  return planKey.replace(/[-_]/g, ' ');
}

function formatPurchaseKindLabel(locale: SupportedLocale, purchaseKind: PaymentOrder['purchaseKind']) {
  if (purchaseKind === 'subscription') {
    return locale === 'en-US' ? 'Subscription' : '订阅';
  }

  return locale === 'en-US' ? 'Credit pack' : '积分包';
}

function formatOrderAmount(locale: SupportedLocale, order: PaymentOrder) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: order.currency,
  }).format(order.amountCents / 100);
}

function resolveBillingStatusTone(value: string) {
  switch (value) {
    case 'paid':
    case 'active':
      return 'success';
    case 'pending':
    case 'queued':
      return 'pending';
    case 'processing':
    case 'running':
      return 'running';
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'danger';
    default:
      return 'muted';
  }
}

function resolveLedgerDeltaTone(value: number) {
  if (value > 0) {
    return 'success';
  }

  if (value < 0) {
    return 'danger';
  }

  return 'muted';
}

function resolveTaskTypeLabel(
  jobKind: GenerationJobKind,
  labels: BillingClientProps['labels']
) {
  switch (jobKind) {
    case 'script-generation':
      return labels.taskTypeScriptGeneration;
    case 'storyboard-generation':
      return labels.taskTypeStoryboardGeneration;
    case 'export-generation':
      return labels.taskTypeExportGeneration;
    case 'analysis-generation':
      return labels.taskTypeAnalysisGeneration;
    default:
      return jobKind;
  }
}

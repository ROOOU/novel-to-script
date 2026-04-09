'use client';

import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (!initialCheckout?.status || handledCheckoutRef.current) {
      return;
    }

    handledCheckoutRef.current = true;

    if (initialCheckout.status === 'cancelled') {
      clearCheckoutQuery();
      return;
    }

    void reconcileCheckout();
  }, [initialCheckout]);

  async function reconcileCheckout() {
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
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <section className="workspace-hero billing-hero">
        <div className="projects-hero-copy">
          <span className="eyebrow">{locale === 'en-US' ? 'Billing' : '账单'}</span>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <div className="projects-hero-aside">
          <div className="metric-card metric-card-matcha">
            <span>{locale === 'en-US' ? 'Available' : '可用积分'}</span>
            <strong>{creditAccount?.availableCredits ?? 0}</strong>
          </div>
          <div className="metric-card metric-card-blueberry">
            <span>PayPal</span>
            <strong>{subscription?.planKey ?? 'free'}</strong>
          </div>
        </div>
      </section>

      {checkoutNotice ? (
        <section className={`card stack-gap-sm status-panel status-panel-${checkoutNotice.tone}`}>
          <strong>PayPal</strong>
          <p>{checkoutNotice.message}</p>
        </section>
      ) : null}

      <section className="workspace-grid">
        <article className="card stack-gap">
          <div>
            <small>{labels.currentPlan}</small>
            <h2>{subscription?.planKey ?? 'free'}</h2>
            <p>{subscription?.status ?? 'active'}</p>
          </div>
          <div>
            <small>{labels.creditsBalance}</small>
            <h2>{creditAccount?.availableCredits ?? 0}</h2>
          </div>
          <div className="timeline-meta-grid timeline-meta-grid-secondary">
            <div className="timeline-meta-card">
              <span>{labels.reservedCredits}</span>
              <strong>{creditAccount?.reservedCredits ?? 0}</strong>
            </div>
            <div className="timeline-meta-card">
              <span>{labels.grantedTotal}</span>
              <strong>{creditAccount?.grantedCreditsTotal ?? 0}</strong>
            </div>
            <div className="timeline-meta-card">
              <span>{labels.consumedTotal}</span>
              <strong>{creditAccount?.consumedCreditsTotal ?? 0}</strong>
            </div>
          </div>
          <div className="stack-gap-sm">
            <p className="helper-text">{`${labels.openPortal}: ${subscription?.provider ?? 'paypal'}`}</p>
            <p className="helper-text">{labels.manualMessage}</p>
          </div>
        </article>

        <article className="card stack-gap billing-usage-card">
          <div className="list-row">
            <div className="stack-gap-sm">
              <h2>{labels.usageTitle}</h2>
              <p className="helper-text">{labels.usageSubtitle}</p>
            </div>
            <div className="list-row-meta">
              <span>{labels.usageThisMonth}</span>
              <strong>{formatUsageCredits(locale, usage.totalCreditsConsumed, labels.usageCreditsUnit)}</strong>
            </div>
          </div>

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

        <article className="card stack-gap">
          <h2>{labels.orders}</h2>
          <div className="stack-gap">
            {paymentOrders.map((order) => (
              <div key={order.id} className="list-row">
                <div>
                  <strong>{order.purchaseKind}</strong>
                  <p>{order.planKey ?? order.creditPackKey ?? order.id}</p>
                  <p className="helper-text">{order.providerOrderId ?? order.id}</p>
                </div>
                <div className="list-row-meta">
                  <span>{order.status}</span>
                  <span>
                    {new Intl.NumberFormat(locale, {
                      style: 'currency',
                      currency: order.currency,
                    }).format(order.amountCents / 100)}
                  </span>
                </div>
              </div>
            ))}
            {paymentOrders.length === 0 ? <p className="helper-text">{labels.noOrders}</p> : null}
          </div>
        </article>

        <article className="card stack-gap">
          <h2>{labels.creditActivity}</h2>
          <div className="stack-gap">
            {ledgerEntries.slice(0, 6).map((entry) => (
              <div key={entry.id} className="list-row">
                <div>
                  <strong>{entry.kind}</strong>
                  <p>{entry.note ?? (locale === 'en-US' ? 'No note' : '无备注')}</p>
                </div>
                <div className="list-row-meta">
                  <span>{entry.deltaCredits > 0 ? `+${entry.deltaCredits}` : entry.deltaCredits}</span>
                  <span>{entry.balanceAfter}</span>
                </div>
              </div>
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

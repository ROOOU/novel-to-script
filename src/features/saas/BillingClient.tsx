'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  CreditAccount,
  CreditLedgerEntry,
  PaymentOrder,
  Subscription,
  SupportedLocale,
} from '@/server/shared/platform/domain';

interface BillingClientProps {
  locale: SupportedLocale;
  subscription: Subscription | null;
  creditAccount: CreditAccount | null;
  paymentOrders: PaymentOrder[];
  ledgerEntries: CreditLedgerEntry[];
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
    orders: string;
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
  initialCheckout,
  labels,
}: BillingClientProps) {
  const [subscription, setSubscription] = useState(initialSubscription);
  const [creditAccount, setCreditAccount] = useState(initialCreditAccount);
  const [paymentOrders, setPaymentOrders] = useState(initialPaymentOrders);
  const [ledgerEntries, setLedgerEntries] = useState(initialLedgerEntries);
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
    if (initialCheckout?.purchaseKind === 'credit-pack') {
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
      <section className="workspace-hero">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
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
              <span>{locale === 'en-US' ? 'Reserved credits' : '预留积分'}</span>
              <strong>{creditAccount?.reservedCredits ?? 0}</strong>
            </div>
            <div className="timeline-meta-card">
              <span>{locale === 'en-US' ? 'Granted total' : '累计发放'}</span>
              <strong>{creditAccount?.grantedCreditsTotal ?? 0}</strong>
            </div>
            <div className="timeline-meta-card">
              <span>{locale === 'en-US' ? 'Consumed total' : '累计消耗'}</span>
              <strong>{creditAccount?.consumedCreditsTotal ?? 0}</strong>
            </div>
          </div>
          <div className="stack-gap-sm">
            <p className="helper-text">{`${labels.openPortal}: ${subscription?.provider ?? 'paypal'}`}</p>
            <p className="helper-text">{labels.manualMessage}</p>
          </div>
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
            {paymentOrders.length === 0 ? (
              <p className="helper-text">{locale === 'en-US' ? 'No orders yet.' : '还没有支付订单。'}</p>
            ) : null}
          </div>
        </article>

        <article className="card stack-gap">
          <h2>{locale === 'en-US' ? 'Credit activity' : '积分流水'}</h2>
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
            {ledgerEntries.length === 0 ? (
              <p className="helper-text">{locale === 'en-US' ? 'No credit activity yet.' : '还没有积分流水。'}</p>
            ) : null}
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

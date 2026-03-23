'use client';

import type { CreditAccount, PaymentOrder, Subscription, SupportedLocale } from '@/server/shared/platform/domain';

interface BillingClientProps {
  locale: SupportedLocale;
  subscription: Subscription | null;
  creditAccount: CreditAccount | null;
  paymentOrders: PaymentOrder[];
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
  subscription,
  creditAccount,
  paymentOrders,
  labels,
}: BillingClientProps) {
  async function handleOpenPortal() {
    const response = await fetch('/api/billing/portal-session', { method: 'POST' });
    const payload = await response.json();
    if (payload.url) {
      window.location.href = payload.url;
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
        <article className="card stack-gap">
          <div>
            <small>{labels.currentPlan}</small>
            <h2>{subscription?.planKey ?? 'trial'}</h2>
            <p>{subscription?.status ?? 'trialing'}</p>
          </div>
          <div>
            <small>{labels.creditsBalance}</small>
            <h2>{creditAccount?.availableCredits ?? 0}</h2>
          </div>
          {subscription?.provider === 'stripe' ? (
            <button type="button" className="secondary-button" onClick={handleOpenPortal}>
              {labels.openPortal}
            </button>
          ) : (
            <p className="helper-text">{labels.manualMessage}</p>
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
                </div>
                <div className="list-row-meta">
                  <span>{order.status}</span>
                  <span>{new Intl.NumberFormat(locale, { style: 'currency', currency: order.currency }).format(order.amountCents / 100)}</span>
                </div>
              </div>
            ))}
            {paymentOrders.length === 0 ? <p className="helper-text">No orders yet.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

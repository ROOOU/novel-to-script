'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PaymentOrder, RedeemCodeCampaign, SupportedLocale } from '@/server/shared/platform/domain';

interface AdminClientProps {
  locale: SupportedLocale;
  campaigns: RedeemCodeCampaign[];
  paymentOrders: PaymentOrder[];
  labels: {
    title: string;
    subtitle: string;
    createCampaign: string;
    campaignName: string;
    creditsGranted: string;
    generateCodes: string;
    paymentOrders: string;
    confirmPayment: string;
    devTestingTitle: string;
    devTestingSubtitle: string;
    openDevTesting: string;
  };
}

export function AdminClient({ locale, campaigns: initialCampaigns, paymentOrders: initialOrders, labels }: AdminClientProps) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [orders, setOrders] = useState(initialOrders);
  const [name, setName] = useState('');
  const [creditsGranted, setCreditsGranted] = useState(60);

  async function handleCreateCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/admin/redeem-code-campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        creditsGranted,
        status: 'active',
      }),
    });
    const payload = await response.json();
    if (payload.campaign) {
      setCampaigns((current) => [payload.campaign as RedeemCodeCampaign, ...current]);
      setName('');
    }
  }

  async function handleGenerateCodes(campaignId: string) {
    await fetch(`/api/admin/redeem-code-campaigns/${campaignId}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ count: 10 }),
    });
  }

  async function handleConfirmOrder(orderId: string) {
    const response = await fetch(`/api/admin/payment-orders/${orderId}/confirm`, { method: 'POST' });
    const payload = await response.json();
    if (payload.order) {
      setOrders((current) =>
        current.map((order) => (order.id === payload.order.id ? payload.order as PaymentOrder : order))
      );
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
          <div className="stack-gap-sm">
            <h2>{labels.devTestingTitle}</h2>
            <p>{labels.devTestingSubtitle}</p>
          </div>
          <Link href={`/${locale}/dev-testing`} className="primary-button">
            {labels.openDevTesting}
          </Link>
        </article>

        <div className="stack-gap">
          <form className="card stack-gap" onSubmit={handleCreateCampaign}>
            <h2>{labels.createCampaign}</h2>
            <label className="field">
              <span>{labels.campaignName}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field">
              <span>{labels.creditsGranted}</span>
              <input
                value={creditsGranted}
                onChange={(event) => setCreditsGranted(Number(event.target.value))}
                type="number"
                min={1}
              />
            </label>
            <button type="submit" className="primary-button">{labels.createCampaign}</button>
          </form>

          {campaigns.map((campaign) => (
            <article key={campaign.id} className="card stack-gap">
              <div className="list-row">
                <div>
                  <strong>{campaign.name}</strong>
                  <p>{campaign.status}</p>
                </div>
                <span>{campaign.creditsGranted}</span>
              </div>
              <button type="button" className="secondary-button" onClick={() => handleGenerateCodes(campaign.id)}>
                {labels.generateCodes}
              </button>
            </article>
          ))}
        </div>

        <article className="card stack-gap">
          <h2>{labels.paymentOrders}</h2>
          {orders.map((order) => (
            <div key={order.id} className="list-row">
              <div>
                <strong>{order.purchaseKind}</strong>
                <p>{new Date(order.createdAt).toLocaleString(locale)}</p>
              </div>
              <div className="list-row-meta">
                <span>{order.status}</span>
                {order.status !== 'paid' ? (
                  <button type="button" className="secondary-button" onClick={() => handleConfirmOrder(order.id)}>
                    {labels.confirmPayment}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </article>
      </section>
    </div>
  );
}

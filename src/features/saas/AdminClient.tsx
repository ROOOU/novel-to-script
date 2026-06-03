'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  WorkspaceCapabilityCard,
  WorkspaceFeedback,
  WorkspaceFormActions,
  WorkspaceFormCard,
  WorkspaceFormHeader,
  WorkspaceHero,
  WorkspaceListRow,
  WorkspaceListRowMeta,
  WorkspaceMetricCard,
  WorkspaceNoteCard,
  WorkspaceStatusPill,
} from '@/components/WorkspaceUI';
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
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);
  const activeCampaignCount = campaigns.filter((campaign) => campaign.status === 'active').length;
  const pendingOrderCount = orders.filter((order) => order.status !== 'paid').length;
  const latestCampaign =
    [...campaigns].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )[0] ?? null;
  const overviewCards =
    locale === 'en-US'
      ? [
          {
            badge: 'Dev',
            eyebrow: 'Testing',
            title: 'Keep the developer channel one click away',
            description: 'Operational QA flows are part of the same platform and should stay close to campaigns and billing actions.',
            tone: 'delivery',
            meta: [
              { label: 'Route', value: '/dev-testing' },
              { label: 'Purpose', value: 'Seed demo data' },
            ],
          },
          {
            badge: 'Codes',
            eyebrow: 'Campaigns',
            title: 'Manage redeem campaigns with visible grant values',
            description: 'Campaigns should show active state and grant size at a glance before code generation starts.',
            tone: 'source',
            meta: [
              { label: 'Campaigns', value: `${campaigns.length}` },
              { label: 'Active', value: `${activeCampaignCount}` },
            ],
          },
          {
            badge: 'Payments',
            eyebrow: 'Orders',
            title: 'Keep manual payment confirmation near the ledger',
            description: 'Operational payment review should remain visible when an order still needs confirmation.',
            tone: 'script',
            meta: [
              { label: 'Orders', value: `${orders.length}` },
              { label: 'Pending', value: `${pendingOrderCount}` },
            ],
          },
          {
            badge: 'Recent',
            eyebrow: 'Latest',
            title: 'See the most recent campaign without drilling down',
            description: 'The newest campaign should stay in the summary layer so support and QA can orient quickly.',
            tone: 'storyboard',
            meta: [
              { label: 'Campaign', value: latestCampaign?.name ?? 'No campaigns yet' },
              { label: 'Grant', value: latestCampaign ? `${latestCampaign.creditsGranted}` : '-' },
            ],
          },
        ]
      : [
          {
            badge: '调试',
            eyebrow: '测试',
            title: '把开发通道放在运营页旁边',
            description: 'QA 场景和运营动作属于同一平台，不该被拆到另一套孤立入口里。',
            tone: 'delivery',
            meta: [
              { label: '入口', value: '/dev-testing' },
              { label: '用途', value: '注入演示数据' },
            ],
          },
          {
            badge: '活动',
            eyebrow: '兑换码',
            title: '让活动码状态和发放额度一眼能看懂',
            description: '生成兑换码之前，活动状态和发放积分应该先在摘要层看清楚。',
            tone: 'source',
            meta: [
              { label: '活动数', value: `${campaigns.length}` },
              { label: '激活中', value: `${activeCampaignCount}` },
            ],
          },
          {
            badge: '支付',
            eyebrow: '订单',
            title: '把手动确认支付放在账单动作旁边',
            description: '当订单还没确认时，运营页应该直接能处理，而不是再去翻别的后台入口。',
            tone: 'script',
            meta: [
              { label: '订单', value: `${orders.length}` },
              { label: '待确认', value: `${pendingOrderCount}` },
            ],
          },
          {
            badge: '最近',
            eyebrow: '活动',
            title: '最新活动直接留在摘要层里',
            description: '支持和 QA 先看见最近一次活动，再决定是否继续生成或排查问题。',
            tone: 'storyboard',
            meta: [
              { label: '活动名', value: latestCampaign?.name ?? '暂无活动' },
              { label: '积分', value: latestCampaign ? `${latestCampaign.creditsGranted}` : '-' },
            ],
          },
        ];

  async function handleCreateCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingKey('campaign:create');
    setFeedbackMessage(null);
    try {
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
        setFeedbackMessage({
          tone: 'success',
          text: locale === 'en-US' ? 'Campaign created.' : '活动已创建。',
        });
        return;
      }

      setFeedbackMessage({
        tone: 'danger',
        text: locale === 'en-US' ? 'Unable to create campaign.' : '暂时无法创建活动。',
      });
    } catch {
      setFeedbackMessage({
        tone: 'danger',
        text: locale === 'en-US' ? 'Unable to create campaign.' : '暂时无法创建活动。',
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleGenerateCodes(campaignId: string) {
    setPendingKey(`campaign:generate:${campaignId}`);
    setFeedbackMessage(null);
    try {
      await fetch(`/api/admin/redeem-code-campaigns/${campaignId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: 10 }),
      });
      setFeedbackMessage({
        tone: 'success',
        text: locale === 'en-US' ? 'Codes generated.' : '兑换码已生成。',
      });
    } catch {
      setFeedbackMessage({
        tone: 'danger',
        text: locale === 'en-US' ? 'Unable to generate codes.' : '暂时无法生成兑换码。',
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function handleConfirmOrder(orderId: string) {
    setPendingKey(`order:confirm:${orderId}`);
    setFeedbackMessage(null);
    try {
      const response = await fetch(`/api/admin/payment-orders/${orderId}/confirm`, { method: 'POST' });
      const payload = await response.json();
      if (payload.order) {
        setOrders((current) =>
          current.map((order) => (order.id === payload.order.id ? payload.order as PaymentOrder : order))
        );
        setFeedbackMessage({
          tone: 'success',
          text: locale === 'en-US' ? 'Payment confirmed.' : '支付已确认。',
        });
        return;
      }

      setFeedbackMessage({
        tone: 'danger',
        text: locale === 'en-US' ? 'Unable to confirm payment.' : '暂时无法确认支付。',
      });
    } catch {
      setFeedbackMessage({
        tone: 'danger',
        text: locale === 'en-US' ? 'Unable to confirm payment.' : '暂时无法确认支付。',
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <WorkspaceHero
        eyebrow={locale === 'en-US' ? 'Operations' : '运营'}
        title={labels.title}
        description={labels.subtitle}
        tags={[
          <span key="campaigns" className="chip chip-count">
            {locale === 'en-US' ? `${campaigns.length} campaigns` : `${campaigns.length} 个活动`}
          </span>,
          <span key="orders" className="chip chip-soft">
            {locale === 'en-US' ? `${pendingOrderCount} pending orders` : `${pendingOrderCount} 个待确认订单`}
          </span>,
          latestCampaign ? (
            <span key="latest" className="chip">
              {locale === 'en-US' ? `Latest ${latestCampaign.name}` : `最近活动：${latestCampaign.name}`}
            </span>
          ) : null,
        ].filter(Boolean)}
        aside={
          <>
          <WorkspaceMetricCard
            tone="matcha"
            label={locale === 'en-US' ? 'Campaigns' : '活动数'}
            value={campaigns.length}
          />
          <WorkspaceMetricCard
            tone="slushie"
            label={locale === 'en-US' ? 'Active' : '激活中'}
            value={activeCampaignCount}
          />
          <WorkspaceMetricCard
            tone="lemon"
            label={locale === 'en-US' ? 'Pending payments' : '待确认支付'}
            value={pendingOrderCount}
          />
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

      <section className="workspace-grid">
        <div className="stack-gap">
          <WorkspaceNoteCard
            tone="slushie"
            eyebrow={locale === 'en-US' ? 'Developer lane' : '开发通道'}
            title={labels.devTestingTitle}
            description={labels.devTestingSubtitle}
            className="stack-gap"
          >
            <Link href={`/${locale}/dev-testing`} className="primary-button">
              {labels.openDevTesting}
            </Link>
          </WorkspaceNoteCard>

          <WorkspaceFormCard as="form" className="project-create-card" onSubmit={handleCreateCampaign}>
            <WorkspaceFormHeader
              eyebrow={locale === 'en-US' ? 'New campaign' : '新建活动'}
              title={labels.createCampaign}
            />
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
            <WorkspaceFormActions>
              <button type="submit" className="primary-button" disabled={pendingKey !== null}>
                {pendingKey === 'campaign:create'
                  ? locale === 'en-US'
                    ? 'Creating...'
                    : '创建中...'
                  : labels.createCampaign}
              </button>
            </WorkspaceFormActions>
            {feedbackMessage ? (
              <WorkspaceFeedback tone={feedbackMessage.tone}>{feedbackMessage.text}</WorkspaceFeedback>
            ) : null}
          </WorkspaceFormCard>

          <article className="card stack-gap">
            <h2>{locale === 'en-US' ? 'Redeem campaigns' : '兑换活动'}</h2>
            {campaigns.length > 0 ? (
              campaigns.map((campaign) => (
                <WorkspaceListRow key={campaign.id}>
                  <div>
                    <strong>{campaign.name}</strong>
                    <p>{locale === 'en-US' ? `${campaign.creditsGranted} credits granted` : `发放 ${campaign.creditsGranted} 积分`}</p>
                  </div>
                  <WorkspaceListRowMeta>
                    <WorkspaceStatusPill tone={resolveAdminStatusTone(campaign.status)}>
                      {formatAdminStatus(locale, campaign.status)}
                    </WorkspaceStatusPill>
                    <span>{new Date(campaign.updatedAt).toLocaleDateString(locale)}</span>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleGenerateCodes(campaign.id)}
                      disabled={pendingKey !== null}
                    >
                      {pendingKey === `campaign:generate:${campaign.id}`
                        ? locale === 'en-US'
                          ? 'Generating...'
                          : '生成中...'
                        : labels.generateCodes}
                    </button>
                  </WorkspaceListRowMeta>
                </WorkspaceListRow>
              ))
            ) : (
              <p className="helper-text">
                {locale === 'en-US' ? 'No campaigns yet.' : '还没有兑换活动。'}
              </p>
            )}
          </article>
        </div>

        <article className="card stack-gap">
          <h2>{labels.paymentOrders}</h2>
          {orders.length > 0 ? (
            orders.map((order) => (
              <WorkspaceListRow key={order.id}>
                <div>
                  <strong>{formatPurchaseKindLabel(locale, order.purchaseKind)}</strong>
                  <p>{new Date(order.createdAt).toLocaleString(locale)}</p>
                </div>
                <WorkspaceListRowMeta>
                  <WorkspaceStatusPill tone={resolveAdminStatusTone(order.status)}>
                    {formatAdminStatus(locale, order.status)}
                  </WorkspaceStatusPill>
                  {order.status !== 'paid' ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleConfirmOrder(order.id)}
                      disabled={pendingKey !== null}
                    >
                      {pendingKey === `order:confirm:${order.id}`
                        ? locale === 'en-US'
                          ? 'Confirming...'
                          : '确认中...'
                        : labels.confirmPayment}
                    </button>
                  ) : null}
                </WorkspaceListRowMeta>
              </WorkspaceListRow>
            ))
          ) : (
            <p className="helper-text">
              {locale === 'en-US' ? 'No payment orders yet.' : '还没有支付订单。'}
            </p>
          )}
        </article>
      </section>
    </div>
  );
}

function formatAdminStatus(locale: SupportedLocale, value: string) {
  const normalized = value.replace(/[-_]/g, ' ');

  if (locale === 'en-US') {
    return normalized;
  }

  switch (value) {
    case 'active':
      return '激活中';
    case 'draft':
      return '草稿';
    case 'pending':
      return '待处理';
    case 'paid':
      return '已支付';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    case 'refunded':
      return '已退款';
    case 'expired':
      return '已过期';
    case 'archived':
      return '已归档';
    default:
      return normalized;
  }
}

function resolveAdminStatusTone(value: string) {
  switch (value) {
    case 'active':
    case 'paid':
      return 'success';
    case 'pending':
    case 'queued':
      return 'pending';
    case 'running':
    case 'processing':
      return 'running';
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'danger';
    default:
      return 'muted';
  }
}

function formatPurchaseKindLabel(locale: SupportedLocale, purchaseKind: PaymentOrder['purchaseKind']) {
  if (purchaseKind === 'subscription') {
    return locale === 'en-US' ? 'Subscription' : '订阅';
  }

  return locale === 'en-US' ? 'Credit pack' : '积分包';
}

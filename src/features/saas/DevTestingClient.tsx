'use client';

import { useEffect, useState } from 'react';
import {
  WorkspaceCapabilityCard,
  WorkspaceFeedback,
  WorkspaceFormActions,
  WorkspaceFormCard,
  WorkspaceFormHeader,
  WorkspaceHero,
  WorkspaceMetricCard,
  WorkspaceMiniList,
  WorkspaceNoteCard,
} from '@/components/WorkspaceUI';
import type { SupportedLocale } from '@/server/shared/platform/domain';

type ScenarioKey = 'credits' | 'payment' | 'project' | 'redeem';

interface DevTestingClientProps {
  locale: SupportedLocale;
  organizationId: string;
  workspaceId: string;
  labels: {
    title: string;
    subtitle: string;
    gateNotice: string;
    backToAdmin: string;
    endpointLabel: string;
    quickGuideTitle: string;
    quickGuideItems: string[];
    seedCreditsTitle: string;
    seedCreditsSubtitle: string;
    organizationId: string;
    creditsDelta: string;
    reason: string;
    seedCreditsAction: string;
    paymentOrderTitle: string;
    paymentOrderSubtitle: string;
    purchaseKind: string;
    amount: string;
    currency: string;
    provider: string;
    reference: string;
    createPaymentOrderAction: string;
    demoProjectTitle: string;
    demoProjectSubtitle: string;
    projectName: string;
    projectGenre: string;
    projectDescription: string;
    sourceTitle: string;
    sourceText: string;
    createProjectAction: string;
    redeemBatchTitle: string;
    redeemBatchSubtitle: string;
    campaignName: string;
    codePrefix: string;
    codeCount: string;
    creditsGranted: string;
    expiresAt: string;
    generateCodesAction: string;
    success: string;
    failure: string;
  };
}

const DEV_SCENARIO_ENDPOINT = '/api/admin/dev/scenarios';
const SCENARIO_MAP = {
  credits: 'grant-credits',
  payment: 'create-payment-order',
  project: 'seed-demo-project',
  redeem: 'create-redeem-campaign',
} as const;

export function DevTestingClient({
  locale,
  organizationId,
  workspaceId,
  labels,
}: DevTestingClientProps) {
  const [pending, setPending] = useState<ScenarioKey | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [results, setResults] = useState<Record<ScenarioKey, { tone: 'success' | 'danger'; message: string } | null>>({
    credits: null,
    payment: null,
    project: null,
    redeem: null,
  });

  const [creditsDelta, setCreditsDelta] = useState(120);
  const [creditReason, setCreditReason] = useState('credit adjustment for QA');

  const [purchaseKind, setPurchaseKind] = useState<'subscription' | 'credit-pack'>('credit-pack');
  const [amountCents, setAmountCents] = useState(9900);
  const [reference, setReference] = useState('dev-demo-001');

  const [projectName, setProjectName] = useState('Dev Demo Project');
  const [projectGenre, setProjectGenre] = useState('urban');
  const [projectDescription, setProjectDescription] = useState('Demo project for testing the workbench flow.');
  const [sourceTitle, setSourceTitle] = useState('Demo source');
  const [sourceText, setSourceText] = useState('Demo source text for integration testing.');

  const [campaignName, setCampaignName] = useState('Dev giveaway');
  const [codePrefix, setCodePrefix] = useState('DEV');
  const [codeCount, setCodeCount] = useState(10);
  const [creditsGranted, setCreditsGranted] = useState(60);
  const [expiresAt, setExpiresAt] = useState('');
  const summaryEntries = summary ? Object.entries(summary) : [];
  const overviewCards =
    locale === 'en-US'
      ? [
          {
            badge: 'Credits',
            eyebrow: 'Balance',
            title: 'Seed credits directly into the active org',
            description: 'This scenario is for QA cases that need immediate balance changes without running a full checkout flow.',
            tone: 'source',
            meta: [
              { label: 'Default', value: `${creditsDelta}` },
              { label: 'Scope', value: 'Organization ledger' },
            ],
          },
          {
            badge: 'Orders',
            eyebrow: 'Payment',
            title: 'Create internal orders for billing drills',
            description: 'Payment scenarios let the team simulate order states and billing reconciliation without touching live checkout.',
            tone: 'script',
            meta: [
              { label: 'Kind', value: purchaseKind },
              { label: 'Amount', value: `${amountCents}` },
            ],
          },
          {
            badge: 'Projects',
            eyebrow: 'Demo',
            title: 'Seed a complete project for workspace walkthroughs',
            description: 'Demo projects help verify source, script, storyboard, and export flows in one pass.',
            tone: 'storyboard',
            meta: [
              { label: 'Genre', value: projectGenre },
              { label: 'Workspace', value: workspaceId },
            ],
          },
          {
            badge: 'Codes',
            eyebrow: 'Redeem',
            title: 'Generate redeem campaigns for end-to-end claims',
            description: 'Campaign and code generation is part of the same QA lane, so ops can test credits and claims together.',
            tone: 'delivery',
            meta: [
              { label: 'Prefix', value: codePrefix },
              { label: 'Count', value: `${codeCount}` },
            ],
          },
        ]
      : [
          {
            badge: '积分',
            eyebrow: '余额',
            title: '直接给当前组织注入测试积分',
            description: '适合需要马上变更余额的 QA 场景，不用完整走一遍真实支付流程。',
            tone: 'source',
            meta: [
              { label: '默认值', value: `${creditsDelta}` },
              { label: '作用域', value: '组织积分流水' },
            ],
          },
          {
            badge: '订单',
            eyebrow: '支付',
            title: '为账单演练生成内部订单',
            description: '支付场景可以模拟订单状态和账单对账，而不必触发真实在线结账。',
            tone: 'script',
            meta: [
              { label: '类型', value: purchaseKind },
              { label: '金额', value: `${amountCents}` },
            ],
          },
          {
            badge: '项目',
            eyebrow: '演示',
            title: '一键注入完整项目用于工作台走查',
            description: '演示项目能把原文、剧本、分镜和导出流程一次性串起来做验证。',
            tone: 'storyboard',
            meta: [
              { label: '题材', value: projectGenre },
              { label: '空间', value: workspaceId },
            ],
          },
          {
            badge: '兑换码',
            eyebrow: '活动',
            title: '把活动和领取场景收在同一条 QA 通道里',
            description: '活动创建和兑换码测试属于同一批验证动作，运营与 QA 可以连着跑完。',
            tone: 'delivery',
            meta: [
              { label: '前缀', value: codePrefix },
              { label: '数量', value: `${codeCount}` },
            ],
          },
        ];

  useEffect(() => {
    void fetch(DEV_SCENARIO_ENDPOINT)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) {
          setSummary(payload.summary as Record<string, unknown>);
        }
      })
      .catch(() => undefined);
  }, []);

  async function submitScenario(
    scenario: ScenarioKey,
    payload: Record<string, unknown>
  ) {
    setPending(scenario);
    setResults((current) => ({
      ...current,
      [scenario]: null,
    }));

    try {
      const response = await fetch(DEV_SCENARIO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario: SCENARIO_MAP[scenario],
          ...payload,
        }),
      });

      const raw = await response.text();
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = raw;
      }

      const message = response.ok
        ? `${labels.success}: ${formatPayloadSummary(parsed)}`
        : `${labels.failure}: ${formatPayloadSummary(parsed)}`;

      if (response.ok && parsed && typeof parsed === 'object' && 'summary' in (parsed as Record<string, unknown>)) {
        setSummary((parsed as { summary?: Record<string, unknown> }).summary ?? null);
      }

      setResults((current) => ({
        ...current,
        [scenario]: {
          tone: response.ok ? 'success' : 'danger',
          message,
        },
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [scenario]: {
          tone: 'danger',
          message: `${labels.failure}: ${error instanceof Error ? error.message : 'NETWORK_ERROR'}`,
        },
      }));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <WorkspaceHero
        eyebrow={locale === 'en-US' ? 'Developer' : '开发'}
        title={labels.title}
        description={labels.subtitle}
        afterDescription={<p className="helper-text">{labels.gateNotice}</p>}
        tags={[
          <span key="scenarios" className="chip chip-count">
            {locale === 'en-US' ? '4 QA scenarios' : '4 个 QA 场景'}
          </span>,
          <span key="org" className="chip chip-soft">
            {locale === 'en-US' ? `Org ${organizationId.slice(0, 8)}` : `组织 ${organizationId.slice(0, 8)}`}
          </span>,
          <span key="workspace" className="chip">
            {locale === 'en-US' ? `Workspace ${workspaceId.slice(0, 8)}` : `空间 ${workspaceId.slice(0, 8)}`}
          </span>,
        ]}
        aside={
          <>
            <WorkspaceMetricCard
              tone="matcha"
              label={locale === 'en-US' ? 'Scenarios' : '场景数'}
              value="4"
            />
            <WorkspaceMetricCard
              tone="slushie"
              label={locale === 'en-US' ? 'Endpoint' : '接口'}
              value={DEV_SCENARIO_ENDPOINT}
            />
            <WorkspaceMetricCard
              tone="lemon"
              label={locale === 'en-US' ? 'Summary keys' : '摘要字段'}
              value={summaryEntries.length}
            />
            <a href={`/${locale}/admin`} className="secondary-button ghost-button">
              {labels.backToAdmin}
            </a>
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
        <WorkspaceNoteCard
          tone="blueberry"
          eyebrow={locale === 'en-US' ? 'Control panel' : '控制面板'}
          title={labels.quickGuideTitle}
          description={`${labels.endpointLabel}: ${DEV_SCENARIO_ENDPOINT}`}
          className="stack-gap"
        >
          <WorkspaceMiniList
            items={[
              {
                key: 'organization',
                label: labels.organizationId,
                value: organizationId,
              },
              {
                key: 'scope',
                label: locale === 'en-US' ? 'Execution scope' : '执行范围',
                value: workspaceId,
              },
              {
                key: 'summary',
                label: locale === 'en-US' ? 'Summary items' : '摘要项',
                value: summaryEntries.length,
              },
            ]}
          />
          {summary ? (
            <div className="stack-gap-sm">
              {summaryEntries.map(([key, value]) => (
                <p key={key} className="helper-text">
                  {key}: {String(value)}
                </p>
              ))}
            </div>
          ) : null}
          <div className="stack-gap-sm">
            {labels.quickGuideItems.map((item) => (
              <p key={item} className="helper-text">{item}</p>
            ))}
          </div>
        </WorkspaceNoteCard>

        <WorkspaceFormCard>
          <WorkspaceFormHeader title={labels.seedCreditsTitle} description={labels.seedCreditsSubtitle} />
          <label className="field">
            <span>{labels.creditsDelta}</span>
            <input
              type="number"
              min={1}
              value={creditsDelta}
              onChange={(event) => setCreditsDelta(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>{labels.reason}</span>
            <input value={creditReason} onChange={(event) => setCreditReason(event.target.value)} />
          </label>
          <WorkspaceFormActions>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void submitScenario('credits', {
                  organizationId,
                  deltaCredits: creditsDelta,
                  reason: creditReason,
                })
              }
              disabled={pending !== null}
            >
              {pending === 'credits' ? `${labels.seedCreditsAction}...` : labels.seedCreditsAction}
            </button>
          </WorkspaceFormActions>
          <ResultLine value={results.credits} />
        </WorkspaceFormCard>
      </section>

      <section className="workspace-grid">
        <WorkspaceFormCard>
          <WorkspaceFormHeader title={labels.paymentOrderTitle} description={labels.paymentOrderSubtitle} />
          <div className="form-grid">
            <label className="field">
              <span>{labels.purchaseKind}</span>
              <select value={purchaseKind} onChange={(event) => setPurchaseKind(event.target.value as typeof purchaseKind)}>
                <option value="credit-pack">credit-pack</option>
                <option value="subscription">subscription</option>
              </select>
            </label>
            <label className="field">
              <span>{labels.amount}</span>
              <input type="number" min={1} value={amountCents} onChange={(event) => setAmountCents(Number(event.target.value))} />
            </label>
            <label className="field">
              <span>{labels.currency}</span>
              <input value="USD" readOnly />
            </label>
            <label className="field">
              <span>{labels.provider}</span>
              <input value="internal" readOnly />
            </label>
          </div>
          <label className="field">
            <span>{labels.reference}</span>
            <input value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
          <WorkspaceFormActions>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void submitScenario('payment', {
                  organizationId,
                  workspaceId,
                  purchaseKind,
                  amountCents,
                  currency: 'USD',
                  provider: 'internal',
                  reference,
                })
              }
              disabled={pending !== null}
            >
              {pending === 'payment' ? `${labels.createPaymentOrderAction}...` : labels.createPaymentOrderAction}
            </button>
          </WorkspaceFormActions>
          <ResultLine value={results.payment} />
        </WorkspaceFormCard>

        <WorkspaceFormCard>
          <WorkspaceFormHeader title={labels.demoProjectTitle} description={labels.demoProjectSubtitle} />
          <label className="field">
            <span>{labels.projectName}</span>
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>{labels.projectGenre}</span>
              <input value={projectGenre} onChange={(event) => setProjectGenre(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.sourceTitle}</span>
              <input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>{labels.projectDescription}</span>
            <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} rows={3} />
          </label>
          <label className="field">
            <span>{labels.sourceText}</span>
            <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={5} />
          </label>
          <WorkspaceFormActions>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void submitScenario('project', {
                  organizationId,
                  workspaceId,
                  name: projectName,
                  genre: projectGenre,
                  description: projectDescription,
                  sourceTitle,
                  sourceText,
                })
              }
              disabled={pending !== null}
            >
              {pending === 'project' ? `${labels.createProjectAction}...` : labels.createProjectAction}
            </button>
          </WorkspaceFormActions>
          <ResultLine value={results.project} />
        </WorkspaceFormCard>
      </section>

      <section className="workspace-grid">
        <WorkspaceFormCard>
          <WorkspaceFormHeader title={labels.redeemBatchTitle} description={labels.redeemBatchSubtitle} />
          <label className="field">
            <span>{labels.campaignName}</span>
            <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>{labels.codePrefix}</span>
              <input value={codePrefix} onChange={(event) => setCodePrefix(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.codeCount}</span>
              <input type="number" min={1} value={codeCount} onChange={(event) => setCodeCount(Number(event.target.value))} />
            </label>
            <label className="field">
              <span>{labels.creditsGranted}</span>
              <input type="number" min={1} value={creditsGranted} onChange={(event) => setCreditsGranted(Number(event.target.value))} />
            </label>
            <label className="field">
              <span>{labels.expiresAt}</span>
              <input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} placeholder="2026-04-01T00:00:00Z" />
            </label>
          </div>
          <WorkspaceFormActions>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void submitScenario('redeem', {
                  organizationId,
                  campaignName,
                  codePrefix,
                  codeCount,
                  creditsGranted,
                  expiresAt: expiresAt || null,
                })
              }
              disabled={pending !== null}
            >
              {pending === 'redeem' ? `${labels.generateCodesAction}...` : labels.generateCodesAction}
            </button>
          </WorkspaceFormActions>
          <ResultLine value={results.redeem} />
        </WorkspaceFormCard>
      </section>
    </div>
  );
}

function ResultLine({ value }: { value: { tone: 'success' | 'danger'; message: string } | null }) {
  if (!value) {
    return null;
  }

  return <WorkspaceFeedback tone={value.tone} className="tool-result-line">{value.message}</WorkspaceFeedback>;
}

function formatPayloadSummary(payload: unknown): string {
  if (payload === null) {
    return 'null';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'object') {
    const keys = Object.keys(payload as Record<string, unknown>);
    if (keys.length === 0) {
      return 'ok';
    }
    return keys.slice(0, 4).join(', ');
  }

  return String(payload);
}

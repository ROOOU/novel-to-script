'use client';

import { useEffect, useState } from 'react';
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
  const [results, setResults] = useState<Record<ScenarioKey, string | null>>({
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
        [scenario]: message,
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [scenario]: `${labels.failure}: ${error instanceof Error ? error.message : 'NETWORK_ERROR'}`,
      }));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <section className="workspace-hero">
        <div>
          <p className="helper-text">{labels.gateNotice}</p>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <a href={`/${locale}/admin`} className="secondary-button ghost-button">
          {labels.backToAdmin}
        </a>
      </section>

      <section className="workspace-grid">
        <article className="card stack-gap">
          <div className="stack-gap-sm">
            <h2>{labels.quickGuideTitle}</h2>
            <p>{labels.endpointLabel}: {DEV_SCENARIO_ENDPOINT}</p>
          </div>
          <div className="stack-gap-sm">
            {labels.quickGuideItems.map((item) => (
              <p key={item} className="helper-text">{item}</p>
            ))}
          </div>
          <div className="list-row">
            <span className="helper-text">{labels.organizationId}: {organizationId}</span>
            <span className="helper-text">{locale === 'en-US' ? 'Execution scope' : '执行范围'}: {workspaceId}</span>
          </div>
          {summary ? (
            <div className="stack-gap-sm">
              {Object.entries(summary).map(([key, value]) => (
                <p key={key} className="helper-text">
                  {key}: {String(value)}
                </p>
              ))}
            </div>
          ) : null}
        </article>

        <article className="card stack-gap">
          <h2>{labels.seedCreditsTitle}</h2>
          <p>{labels.seedCreditsSubtitle}</p>
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
          <ResultLine value={results.credits} />
        </article>
      </section>

      <section className="workspace-grid">
        <article className="card stack-gap">
          <h2>{labels.paymentOrderTitle}</h2>
          <p>{labels.paymentOrderSubtitle}</p>
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
          <ResultLine value={results.payment} />
        </article>

        <article className="card stack-gap">
          <h2>{labels.demoProjectTitle}</h2>
          <p>{labels.demoProjectSubtitle}</p>
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
          <ResultLine value={results.project} />
        </article>
      </section>

      <section className="workspace-grid">
        <article className="card stack-gap">
          <h2>{labels.redeemBatchTitle}</h2>
          <p>{labels.redeemBatchSubtitle}</p>
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
          <ResultLine value={results.redeem} />
        </article>
      </section>
    </div>
  );
}

function ResultLine({ value }: { value: string | null }) {
  if (!value) {
    return null;
  }

  return <p className="helper-text">{value}</p>;
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

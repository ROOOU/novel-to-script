'use client';

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
  WorkspaceMiniList,
  WorkspaceNoteCard,
  WorkspaceStatusPill,
} from '@/components/WorkspaceUI';
import type { CreditLedgerEntry, SupportedLocale } from '@/server/shared/platform/domain';

interface RedeemClientProps {
  locale: SupportedLocale;
  ledgerEntries: CreditLedgerEntry[];
  labels: {
    title: string;
    subtitle: string;
    placeholder: string;
    action: string;
    history: string;
  };
}

export function RedeemClient({ locale, ledgerEntries, labels }: RedeemClientProps) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const redeemEntries = ledgerEntries
    .filter((entry) => entry.kind === 'redeem_code_grant')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const totalRedeemedCredits = redeemEntries.reduce((sum, entry) => sum + Math.max(entry.deltaCredits, 0), 0);
  const latestRedeem = redeemEntries[0] ?? null;
  const overviewCards =
    locale === 'en-US'
      ? [
          {
            badge: 'Entry',
            eyebrow: 'Redeem',
            title: 'Use one code to refill the same studio balance',
            description: 'Redeem codes land in the shared credit ledger, so bonus credits stay visible inside the same billing trail.',
            tone: 'source',
            meta: [
              { label: 'Action', value: 'Enter and redeem' },
              { label: 'Destination', value: 'Shared credit account' },
            ],
          },
          {
            badge: 'History',
            eyebrow: 'Ledger',
            title: 'Keep grant history readable after each claim',
            description: 'Every successful redemption shows up in the ledger with time and note, which makes support and QA faster.',
            tone: 'script',
            meta: [
              { label: 'Claims', value: `${redeemEntries.length}` },
              { label: 'Credits', value: `${totalRedeemedCredits}` },
            ],
          },
          {
            badge: 'Timing',
            eyebrow: 'Latest',
            title: 'See the newest grant without leaving this page',
            description: 'Recent redemptions should be immediately visible, especially when someone is testing campaign or coupon flows.',
            tone: 'storyboard',
            meta: [
              { label: 'Latest', value: latestRedeem ? formatRedeemDate(locale, latestRedeem.createdAt) : 'No records yet' },
              { label: 'Grant', value: latestRedeem ? `+${latestRedeem.deltaCredits}` : '-' },
            ],
          },
        ]
      : [
          {
            badge: '入口',
            eyebrow: '兑换',
            title: '把兑换码直接补进同一个积分账户',
            description: '兑换得到的积分会进入同一条账单流水，不会变成另一套分散记录。',
            tone: 'source',
            meta: [
              { label: '动作', value: '输入并兑换' },
              { label: '去向', value: '统一积分账户' },
            ],
          },
          {
            badge: '记录',
            eyebrow: '流水',
            title: '每次到账都能在这里复核',
            description: '兑换成功后会带着时间和备注进入流水，排查活动码和测试问题会更轻松。',
            tone: 'script',
            meta: [
              { label: '次数', value: `${redeemEntries.length}` },
              { label: '累计', value: `${totalRedeemedCredits}` },
            ],
          },
          {
            badge: '最近',
            eyebrow: '到账',
            title: '不用跳页也能看到最新一次兑换',
            description: '最近到账时间和积分变化直接放在这里，活动码测试和运营复核都会更顺手。',
            tone: 'storyboard',
            meta: [
              { label: '时间', value: latestRedeem ? formatRedeemDate(locale, latestRedeem.createdAt) : '暂无记录' },
              { label: '积分', value: latestRedeem ? `+${latestRedeem.deltaCredits}` : '-' },
            ],
          },
        ];

  async function handleRedeem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/redeem-codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json();
      setMessage(
        payload.ok
          ? {
              tone: 'success',
              text: locale === 'en-US' ? 'Code redeemed. Credits are available now.' : '兑换成功，积分已到账。',
            }
          : {
              tone: 'danger',
              text: resolveRedeemError(locale, payload.error),
            }
      );
      if (payload.ok) {
        setCode('');
      }
    } catch {
      setMessage({
        tone: 'danger',
        text: locale === 'en-US' ? 'Unable to redeem this code right now.' : '暂时无法兑换这个兑换码。',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <WorkspaceHero
        eyebrow={locale === 'en-US' ? 'Credits' : '积分'}
        title={labels.title}
        description={labels.subtitle}
        tags={[
          <span key="count" className="chip chip-count">
            {locale === 'en-US' ? `${redeemEntries.length} redeemed grants` : `${redeemEntries.length} 次兑换到账`}
          </span>,
          <span key="credits" className="chip chip-soft">
            {locale === 'en-US' ? `${totalRedeemedCredits} credits claimed` : `累计到账 ${totalRedeemedCredits} 积分`}
          </span>,
          latestRedeem ? (
            <span key="latest" className="chip">
              {locale === 'en-US'
                ? `Latest ${formatRedeemDate(locale, latestRedeem.createdAt)}`
                : `最近 ${formatRedeemDate(locale, latestRedeem.createdAt)}`}
            </span>
          ) : null,
        ].filter(Boolean)}
        aside={
          <>
          <WorkspaceMetricCard
            tone="matcha"
            label={locale === 'en-US' ? 'Claims' : '到账次数'}
            value={redeemEntries.length}
          />
          <WorkspaceMetricCard
            tone="lemon"
            label={locale === 'en-US' ? 'Credits' : '累计积分'}
            value={totalRedeemedCredits}
          />
          <WorkspaceMetricCard
            tone="slushie"
            label={locale === 'en-US' ? 'Latest' : '最近到账'}
            value={latestRedeem ? formatRedeemDate(locale, latestRedeem.createdAt) : '--'}
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
        <WorkspaceFormCard as="form" className="project-create-card" onSubmit={handleRedeem}>
          <WorkspaceFormHeader
            eyebrow={locale === 'en-US' ? 'Redeem now' : '立即兑换'}
            title={labels.action}
            description={
              locale === 'en-US'
                ? 'Enter a campaign or support code here and apply the credit grant directly to this workspace.'
                : '在这里输入活动码或支持码，把积分直接补进当前工作台账户。'
            }
          />
          <label className="field">
            <span>{labels.action}</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={labels.placeholder}
              required
            />
          </label>
          <WorkspaceFormActions>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting
                ? locale === 'en-US'
                  ? 'Redeeming...'
                  : '兑换中...'
                : labels.action}
            </button>
          </WorkspaceFormActions>
          {message ? <WorkspaceFeedback tone={message.tone}>{message.text}</WorkspaceFeedback> : null}
        </WorkspaceFormCard>

        <div className="stack-gap">
          <WorkspaceNoteCard
            tone="matcha"
            title={locale === 'en-US' ? 'Redeemed credits stay in the same production ledger' : '兑换积分会落进同一条生产流水里'}
            eyebrow={locale === 'en-US' ? 'How it lands' : '到账方式'}
            description={
              locale === 'en-US'
                ? 'That means billing, QA, and support can all verify grants without leaving the workspace.'
                : '这意味着账单、QA 和运营支持都能在工作台里直接复核兑换结果。'
            }
            className="stack-gap"
          >
            <WorkspaceMiniList
              items={[
                {
                  key: 'ledger',
                  label: locale === 'en-US' ? 'Ledger entries' : '流水记录',
                  value: redeemEntries.length,
                },
                {
                  key: 'claimed',
                  label: locale === 'en-US' ? 'Claimed credits' : '累计到账',
                  value: totalRedeemedCredits,
                },
                {
                  key: 'note',
                  label: locale === 'en-US' ? 'Latest note' : '最近备注',
                  value: latestRedeem?.note ?? (locale === 'en-US' ? 'No note yet' : '暂无备注'),
                },
              ]}
            />
          </WorkspaceNoteCard>

          <article className="card stack-gap">
            <h2>{labels.history}</h2>
            {redeemEntries.length > 0 ? (
              redeemEntries.map((entry) => (
                <WorkspaceListRow key={entry.id}>
                  <div>
                    <strong>{entry.note ?? entry.kind}</strong>
                    <p>{new Date(entry.createdAt).toLocaleString(locale)}</p>
                  </div>
                  <WorkspaceListRowMeta>
                    <WorkspaceStatusPill tone="success">+{entry.deltaCredits}</WorkspaceStatusPill>
                    <span>{formatRedeemDate(locale, entry.createdAt)}</span>
                  </WorkspaceListRowMeta>
                </WorkspaceListRow>
              ))
            ) : (
              <p className="helper-text">
                {locale === 'en-US' ? 'No redeemed credit records yet.' : '还没有兑换到账记录。'}
              </p>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

function resolveRedeemError(locale: SupportedLocale, code?: string) {
  switch (code) {
    case 'REDEEM_CODE_NOT_FOUND':
      return locale === 'en-US' ? 'This redeem code does not exist.' : '这个兑换码不存在。';
    case 'REDEEM_CODE_DISABLED':
      return locale === 'en-US' ? 'This redeem code is disabled.' : '这个兑换码已停用。';
    case 'REDEEM_CODE_EXPIRED':
      return locale === 'en-US' ? 'This redeem code has expired.' : '这个兑换码已过期。';
    case 'REDEEM_CODE_ARCHIVED':
      return locale === 'en-US' ? 'This redeem code is archived.' : '这个兑换码已归档。';
    case 'REDEEM_LIMIT_REACHED':
      return locale === 'en-US' ? 'This redeem code has reached its limit.' : '这个兑换码已经达到领取上限。';
    case 'REDEEM_ALREADY_USED':
      return locale === 'en-US' ? 'This redeem code has already been used.' : '这个兑换码已经使用过了。';
    default:
      return code ?? (locale === 'en-US' ? 'Unable to redeem this code.' : '暂时无法兑换这个兑换码。');
  }
}

function formatRedeemDate(locale: SupportedLocale, value: string) {
  return new Date(value).toLocaleDateString(locale);
}

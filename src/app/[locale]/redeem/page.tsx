export const dynamic = 'force-dynamic';

import { RedeemClient } from '@/features/saas/RedeemClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { requireViewerForLocalizedPage } from '@/server/auth/http';
import { getBillingSummary } from '@/server/billing/payments';

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await requireViewerForLocalizedPage(locale, '/redeem');

  const [dictionary, summary] = await Promise.all([
    getDictionary(locale),
    getBillingSummary(viewer.organization.id),
  ]);

  return (
    <RedeemClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      ledgerEntries={summary.ledgerEntries}
      labels={dictionary.redeemPage}
    />
  );
}

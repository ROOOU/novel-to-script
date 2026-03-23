import { redirect } from 'next/navigation';
import { RedeemClient } from '@/features/saas/RedeemClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';
import { getBillingSummary } from '@/server/billing/payments';

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect(`/${locale}/login`);
  }

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

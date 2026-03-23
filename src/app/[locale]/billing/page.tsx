import { redirect } from 'next/navigation';
import { BillingClient } from '@/features/saas/BillingClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';
import { getBillingSummary } from '@/server/billing/payments';

export default async function BillingPage({
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
    <BillingClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      subscription={summary.subscription}
      creditAccount={summary.creditAccount}
      paymentOrders={summary.paymentOrders}
      labels={dictionary.billingPage}
    />
  );
}

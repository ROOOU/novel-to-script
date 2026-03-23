import { redirect } from 'next/navigation';
import { AdminClient } from '@/features/saas/AdminClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';
import { getPlatformRuntime } from '@/server/shared/platform';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect(`/${locale}/login`);
  }

  const runtime = getPlatformRuntime();
  const [dictionary, campaigns, paymentOrders] = await Promise.all([
    getDictionary(locale),
    runtime.redeemCodeCampaigns.list(),
    runtime.paymentOrders.listByOrganizationId(viewer.organization.id),
  ]);

  return (
    <AdminClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      campaigns={campaigns.filter((campaign) => !campaign.organizationId || campaign.organizationId === viewer.organization.id)}
      paymentOrders={paymentOrders}
      labels={dictionary.adminPage}
    />
  );
}

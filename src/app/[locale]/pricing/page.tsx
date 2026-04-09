import { PricingClient } from '@/features/saas/PricingClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { CREDIT_PACK_CATALOG_ENTRIES, PLAN_CATALOG_ENTRIES } from '@/server/billing/catalog';

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return (
    <PricingClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      plans={PLAN_CATALOG_ENTRIES}
      creditPacks={CREDIT_PACK_CATALOG_ENTRIES}
      paypalClientId={process.env.PAYPAL_CLIENT_ID?.trim() || null}
      labels={dictionary.pricingPage}
    />
  );
}

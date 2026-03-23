import { PricingClient } from '@/features/saas/PricingClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { CREDIT_PACK_CATALOG, PLAN_CATALOG } from '@/server/billing/catalog';

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
      plans={Object.values(PLAN_CATALOG)}
      creditPacks={Object.values(CREDIT_PACK_CATALOG)}
      labels={dictionary.pricingPage}
    />
  );
}

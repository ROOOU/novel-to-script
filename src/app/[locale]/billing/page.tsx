import { redirect } from 'next/navigation';
import { BillingClient } from '@/features/saas/BillingClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';
import { getBillingSummary } from '@/server/billing/payments';
import { getBillingUsageSummary } from '@/server/billing/usage';

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect(`/${locale}/login`);
  }

  const [dictionary, summary, usage] = await Promise.all([
    getDictionary(locale),
    getBillingSummary(viewer.organization.id),
    getBillingUsageSummary(viewer.organization.id),
  ]);

  return (
    <BillingClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      subscription={summary.subscription}
      creditAccount={summary.creditAccount}
      paymentOrders={summary.paymentOrders}
      ledgerEntries={summary.ledgerEntries}
      usage={usage}
      initialCheckout={{
        status:
          readSearchParam(resolvedSearchParams.checkout) === 'success'
            ? 'success'
            : readSearchParam(resolvedSearchParams.checkout) === 'cancelled'
              ? 'cancelled'
              : null,
        paymentOrderId: readSearchParam(resolvedSearchParams.paymentOrderId),
        providerOrderId: readSearchParam(resolvedSearchParams.providerOrderId),
        purchaseKind: readPurchaseKind(resolvedSearchParams.purchaseKind),
      }}
      labels={dictionary.billingPage}
    />
  );
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function readPurchaseKind(value: string | string[] | undefined) {
  const candidate = readSearchParam(value);
  if (candidate === 'subscription' || candidate === 'credit-pack') {
    return candidate;
  }

  return null;
}

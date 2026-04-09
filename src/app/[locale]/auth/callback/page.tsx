import { ClerkSessionBridge } from '@/features/saas/ClerkSessionBridge';
import { isSupportedLocale } from '@/i18n/config';

export default async function AuthCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = isSupportedLocale(locale) ? locale : 'zh-CN';
  const { redirect_url } = await searchParams;

  return <ClerkSessionBridge locale={resolvedLocale} redirectUrl={redirect_url} />;
}

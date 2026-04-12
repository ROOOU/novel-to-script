export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { LandingPage } from '@/features/landing/LandingPage';
import { getDictionary } from '@/i18n/get-dictionary';
import { resolveViewerSafely } from '@/server/auth/http';

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [dictionary, viewer] = await Promise.all([
    getDictionary(locale),
    resolveViewerSafely(),
  ]);

  if (viewer) {
    redirect(`/${locale}/projects`);
  }

  return <LandingPage locale={locale === 'en-US' ? 'en-US' : 'zh-CN'} dictionary={dictionary} />;
}

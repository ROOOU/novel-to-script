import { redirect } from 'next/navigation';
import { LandingPage } from '@/features/landing/LandingPage';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [dictionary, viewer] = await Promise.all([
    getDictionary(locale),
    getCurrentViewer(),
  ]);

  if (viewer) {
    redirect(`/${locale}/projects`);
  }

  return <LandingPage locale={locale === 'en-US' ? 'en-US' : 'zh-CN'} dictionary={dictionary} />;
}

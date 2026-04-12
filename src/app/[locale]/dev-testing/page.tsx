export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DevTestingClient } from '@/features/saas/DevTestingClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { requireViewerForLocalizedPage } from '@/server/auth/http';
import { canAccessDeveloperChannel } from '@/server/dev/channel';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return {
    title: `NovelScript | ${dictionary.devTestingPage.title}`,
    description: dictionary.devTestingPage.subtitle,
  };
}

export default async function DevTestingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await requireViewerForLocalizedPage(locale, '/dev-testing');

  if (!canAccessDeveloperChannel(viewer, process.env)) {
    redirect(`/${locale}/admin`);
  }

  const dictionary = await getDictionary(locale);

  return (
    <DevTestingClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      organizationId={viewer.organization.id}
      workspaceId={viewer.workspace.id}
      labels={dictionary.devTestingPage}
    />
  );
}

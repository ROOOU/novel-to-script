export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { resolveViewerSafely } from '@/server/auth/http';

export default async function ConsolePage({
  params,
  }: {
    params: Promise<{ locale: string }>;
  }) {
  const { locale } = await params;
  const viewer = await resolveViewerSafely();

  if (viewer) {
    redirect(`/${locale}/projects`);
  }

  redirect(`/${locale}`);
}

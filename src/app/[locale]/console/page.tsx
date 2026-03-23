import { redirect } from 'next/navigation';
import { getCurrentViewer } from '@/server/auth/service';

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await getCurrentViewer();

  if (viewer) {
    redirect(`/${locale}/projects`);
  }

  redirect(`/${locale}`);
}

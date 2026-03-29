import { redirect } from 'next/navigation';
import { getCurrentViewer } from '@/server/auth/service';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await resolveViewerSafely();
  if (viewer) {
    redirect(`/${viewer.workspace.defaultLocale ?? locale}/projects`);
  }

  redirect('/sign-in');
}

async function resolveViewerSafely() {
  try {
    return await getCurrentViewer();
  } catch {
    return null;
  }
}

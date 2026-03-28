import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/saas/LoginForm';
import { isSupportedLocale } from '@/i18n/config';
import { getCurrentViewer } from '@/server/auth/service';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await getCurrentViewer();
  if (viewer) {
    redirect(`/${viewer.workspace.defaultLocale ?? locale}/projects`);
  }

  const resolvedLocale = isSupportedLocale(locale) ? locale : 'zh-CN';
  return <LoginForm locale={resolvedLocale} />;
}

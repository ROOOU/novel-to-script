import { redirect } from 'next/navigation';
import { SignUpForm } from '@/features/saas/SignUpForm';
import { isSupportedLocale } from '@/i18n/config';
import { resolveViewerSafely } from '@/server/auth/http';

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ redirect_url?: string }>;
}) {
  const { locale } = await params;
  const { redirect_url: redirectUrl } = (await searchParams) ?? {};
  const viewer = await resolveViewerSafely();
  if (viewer) {
    redirect(`/${viewer.workspace.defaultLocale ?? locale}/projects`);
  }

  const resolvedLocale = isSupportedLocale(locale) ? locale : 'zh-CN';
  return <SignUpForm locale={resolvedLocale} redirectUrl={redirectUrl?.trim()} />;
}

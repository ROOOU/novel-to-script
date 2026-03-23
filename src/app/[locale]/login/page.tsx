import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/saas/LoginForm';
import { getDictionary } from '@/i18n/get-dictionary';
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
    redirect(`/${viewer.session.locale}/projects`);
  }

  const resolvedLocale = isSupportedLocale(locale) ? locale : 'zh-CN';
  const dictionary = await getDictionary(resolvedLocale);

  return (
    <LoginForm
      locale={resolvedLocale}
      labels={{
        title: dictionary.login.title,
        subtitle: dictionary.login.subtitle,
        email: dictionary.login.email,
        password: dictionary.login.password,
        displayName: dictionary.login.displayName,
        action: dictionary.login.signupAction,
        helper: dictionary.login.helper,
        invalidCredentials: dictionary.apiMessages.invalidCredentials,
      }}
    />
  );
}

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AppShellHeader } from '@/components/AppShellHeader';
import { LandingPage } from '@/features/landing/LandingPage';
import { getDictionary } from '@/i18n/get-dictionary';
import { resolveLocaleFromAcceptLanguage } from '@/i18n/config';
import { getCurrentViewer } from '@/server/auth/service';

export default async function Home() {
  const viewer = await getCurrentViewer();
  if (viewer) {
    redirect(`/${viewer.session.locale}/projects`);
  }

  const requestHeaders = await headers();
  const locale = resolveLocaleFromAcceptLanguage(requestHeaders.get('accept-language'));
  const dictionary = await getDictionary(locale);

  return (
    <>
      <AppShellHeader
        locale={locale}
        signedIn={false}
        labels={{
          brandBadge: dictionary.common.brandBadge,
          signIn: dictionary.common.signIn,
          signUp: dictionary.common.signUp,
          signOut: dictionary.common.signOut,
          home: dictionary.nav.home,
          pricing: dictionary.nav.pricing,
          projects: dictionary.nav.projects,
          billing: dictionary.nav.billing,
          redeem: dictionary.nav.redeem,
          admin: dictionary.nav.admin,
        }}
      />
      <main>
        <LandingPage locale={locale} dictionary={dictionary} />
      </main>
    </>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShellHeader } from '@/components/AppShellHeader';
import { getDictionary } from '@/i18n/get-dictionary';
import { SUPPORTED_LOCALES, isSupportedLocale } from '@/i18n/config';
import { resolveViewerSafely } from '@/server/auth/http';

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return {
    title: `NovelScript | ${dictionary.landing.eyebrow}`,
    description: dictionary.landing.subtitle,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const [dictionary, viewer] = await Promise.all([
    getDictionary(locale),
    resolveViewerSafely(),
  ]);

  return (
    <>
      <AppShellHeader
        locale={locale}
        signedIn={Boolean(viewer)}
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
        userDisplayName={viewer?.user.displayName}
        initialCredits={viewer?.creditAccount?.availableCredits ?? null}
      />
      <main>{children}</main>
    </>
  );
}

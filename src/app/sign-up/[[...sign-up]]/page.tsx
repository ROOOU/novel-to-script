import { SignUp } from '@clerk/nextjs';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE_NAME, isSupportedLocale, resolveLocaleFromAcceptLanguage } from '@/i18n/config';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const locale = await resolvePreferredLocale();
  const params = await searchParams;
  const redirectUrl = resolveRedirectUrl(params.redirect_url, locale);

  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl={redirectUrl}
    />
  );
}

async function resolvePreferredLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  const requestHeaders = await headers();
  return resolveLocaleFromAcceptLanguage(requestHeaders.get('accept-language'));
}

function resolveRedirectUrl(redirectUrl: string | undefined, locale: string) {
  const normalized = redirectUrl?.trim();
  if (!normalized) {
    return `/${locale}/projects`;
  }

  return normalized;
}

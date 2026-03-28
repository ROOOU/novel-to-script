import { SignUp } from '@clerk/nextjs';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE_NAME, isSupportedLocale, resolveLocaleFromAcceptLanguage } from '@/i18n/config';

export default async function SignUpPage() {
  const locale = await resolvePreferredLocale();
  const redirectUrl = `/${locale}/projects`;

  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl={redirectUrl}
      forceRedirectUrl={redirectUrl}
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

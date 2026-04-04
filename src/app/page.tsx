import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE_NAME, isSupportedLocale, resolveLocaleFromAcceptLanguage } from '@/i18n/config';

export default async function Home() {
  const locale = await resolvePreferredLocale();
  redirect(`/${locale}`);
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

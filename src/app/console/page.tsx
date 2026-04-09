import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveLegacyConsoleRedirect } from '@/app/legacy-route-redirects';
import { getCurrentViewer } from '@/server/auth/service';

export default async function ConsoleLegacyPage() {
  const [viewer, requestHeaders] = await Promise.all([getCurrentViewer(), headers()]);

  redirect(
    resolveLegacyConsoleRedirect({
      viewerLocale: viewer?.session.locale,
      acceptLanguage: requestHeaders.get('accept-language'),
    })
  );
}

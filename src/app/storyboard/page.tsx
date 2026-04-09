import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveLegacyStoryboardRedirect } from '@/app/legacy-route-redirects';
import { getCurrentViewer } from '@/server/auth/service';

export default async function StoryboardPage() {
  const [viewer, requestHeaders] = await Promise.all([getCurrentViewer(), headers()]);

  redirect(
    resolveLegacyStoryboardRedirect({
      viewerLocale: viewer?.session.locale,
      acceptLanguage: requestHeaders.get('accept-language'),
    })
  );
}

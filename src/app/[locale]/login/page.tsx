import { redirect } from 'next/navigation';
import { getDictionary } from '@/i18n/get-dictionary';
import { isSupportedLocale } from '@/i18n/config';
import { GoogleOnlySignInButton } from '@/features/saas/GoogleOnlySignInButton';
import { getCurrentViewer } from '@/server/auth/service';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { locale } = await params;
  const { redirect_url } = await searchParams;
  const viewer = await getCurrentViewer();
  if (viewer) {
    redirect(`/${viewer.session.locale}/projects`);
  }

  const resolvedLocale = isSupportedLocale(locale) ? locale : 'zh-CN';
  const dictionary = await getDictionary(resolvedLocale);
  const callbackPath = `/${resolvedLocale}/auth/callback${redirect_url ? `?redirect_url=${encodeURIComponent(redirect_url)}` : ''}`;
  const googleLabel = resolvedLocale === 'en-US' ? 'Continue with Google' : '使用 Google 账号继续';
  const googleHint = resolvedLocale === 'en-US' ? 'Only Google account sign-in is supported.' : '目前仅支持 Google 账号登录。';

  return (
    <div className="marketing-shell auth-shell">
      <section className="auth-card auth-card-clay">
        <div className="auth-copy">
          <span className="eyebrow">{resolvedLocale === 'en-US' ? 'Sign in' : '登录'}</span>
          <h1>{dictionary.login.title}</h1>
          <p>{dictionary.login.subtitle}</p>
        </div>
        <div className="auth-side-panel">
          <div className="metric-card metric-card-slushie">
            <span>Google</span>
            <strong>{resolvedLocale === 'en-US' ? 'Only supported provider' : '唯一支持的登录方式'}</strong>
          </div>
          <div className="metric-card metric-card-lemon">
            <span>{resolvedLocale === 'en-US' ? 'After sign-in' : '登录后'}</span>
            <strong>{resolvedLocale === 'en-US' ? 'Projects open immediately' : '直接进入项目工作台'}</strong>
          </div>
        </div>
        <GoogleOnlySignInButton
          locale={resolvedLocale}
          callbackPath={callbackPath}
          buttonLabel={googleLabel}
          hint={googleHint}
        />
      </section>
    </div>
  );
}

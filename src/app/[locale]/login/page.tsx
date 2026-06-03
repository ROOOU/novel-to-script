import { redirect } from 'next/navigation';
import {
  WorkspaceMetricCard,
  WorkspaceMiniList,
} from '@/components/WorkspaceUI';
import { getDictionary } from '@/i18n/get-dictionary';
import { isSupportedLocale } from '@/i18n/config';
import { GoogleOnlySignInButton } from '@/features/saas/GoogleOnlySignInButton';
import { LocalDevAccessButton } from '@/features/saas/LocalDevAccessButton';
import { getCurrentViewer } from '@/server/auth/service';
import { isDevAccessEnabled } from '@/server/auth/dev-access';

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
  const devAccessEnabled = isDevAccessEnabled();
  const authPreview =
    resolvedLocale === 'en-US'
      ? {
          entryEyebrow: 'Studio access',
          entryTitle: 'Sign in and go straight back to production',
          entryBody: 'Google keeps the formal session path. The local dev entry stays here for testing builds and demo flows.',
          tags: ['Source -> Script -> Storyboard', 'Prompt pack linked', 'Projects open first'],
          steps: [
            {
              label: 'Source',
              value: 'Save the novel excerpt, brief, and reference notes in one place.',
            },
            {
              label: 'Script',
              value: 'Generate the short-drama draft and keep revisions attached to the same project.',
            },
            {
              label: 'Storyboard',
              value: 'Carry shot plans and Seedance prompt packs forward without splitting the trail.',
            },
          ],
          studioMetric: 'Projects, billing, and exports stay in one studio',
        }
      : {
          entryEyebrow: '进入工作台',
          entryTitle: '登录后直接回到生产线',
          entryBody: 'Google 走正式会话链路，本地开发入口保留给调试和演示流程。',
          tags: ['原文 -> 剧本 -> 分镜', '提示词包关联输出', '登录后先到项目页'],
          steps: [
            {
              label: '原文',
              value: '把小说片段、简述和参考备注集中保存在一个项目里。',
            },
            {
              label: '剧本',
              value: '继续生成短剧剧本，并把修改痕迹留在同一条改编链路上。',
            },
            {
              label: '分镜',
              value: '把 shot plan 和 Seedance prompt pack 一起往下接，不再拆散。',
            },
          ],
          studioMetric: '项目、账单和导出共用同一套工作台',
        };

  return (
    <div className="marketing-shell auth-shell">
      <section className="auth-card auth-card-clay">
        <div className="auth-copy">
          <span className="eyebrow">{resolvedLocale === 'en-US' ? 'Sign in' : '登录'}</span>
          <h1>{dictionary.login.title}</h1>
          <p>{dictionary.login.subtitle}</p>
          <div className="project-hero-tags">
            {authPreview.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
          <WorkspaceMiniList
            items={authPreview.steps.map((step) => ({
              key: step.label,
              label: step.label,
              value: step.value,
            }))}
          />
        </div>
        <div className="auth-side-panel">
          <WorkspaceMetricCard
            tone="slushie"
            label="Google"
            value={resolvedLocale === 'en-US' ? 'Only supported provider' : '唯一支持的登录方式'}
          />
          <WorkspaceMetricCard
            tone="lemon"
            label={resolvedLocale === 'en-US' ? 'After sign-in' : '登录后'}
            value={resolvedLocale === 'en-US' ? 'Projects open immediately' : '直接进入项目工作台'}
          />
          <WorkspaceMetricCard
            tone="matcha"
            label={resolvedLocale === 'en-US' ? 'Studio' : '工作台'}
            value={authPreview.studioMetric}
          />
        </div>
        <div className="auth-entry-shell">
          <div className="auth-entry-header stack-gap-sm">
            <span className="eyebrow">{authPreview.entryEyebrow}</span>
            <h2>{authPreview.entryTitle}</h2>
            <p>{authPreview.entryBody}</p>
          </div>
          <div className="auth-provider-grid">
            <GoogleOnlySignInButton
              locale={resolvedLocale}
              callbackPath={callbackPath}
              buttonLabel={googleLabel}
              hint={googleHint}
            />
            {devAccessEnabled ? (
              <LocalDevAccessButton locale={resolvedLocale} redirectUrl={redirect_url} />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

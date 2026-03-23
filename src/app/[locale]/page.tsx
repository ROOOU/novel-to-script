import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const primaryCtaText = locale === 'en-US' ? 'Open Projects' : '进入项目中心';
  const secondaryCtaText = locale === 'en-US' ? 'View Pricing' : '查看套餐';
  const [dictionary, viewer] = await Promise.all([
    getDictionary(locale),
    getCurrentViewer(),
  ]);

  if (viewer) {
    redirect(`/${locale}/projects`);
  }

  return (
    <div className="landing-home">
      <section className="landing-hero">
        <div className="landing-code landing-code-left">
          <pre>{`const workflow = {
  input: 'novel',
  analysis: 'auto',
  outline: 'episodic',
  script: 'multi-episode'
}`}</pre>
        </div>
        <div className="landing-code landing-code-right">
          <pre>{`status: ready
credits: flexible
queue: durable
export: markdown/json/txt`}</pre>
        </div>
        <span className="eyebrow">{dictionary.landing.eyebrow}</span>
        <h1>{dictionary.landing.title}</h1>
        <p>{dictionary.landing.subtitle}</p>
        <div className="action-row">
          <Link href={`/${locale}/projects`} className="primary-button">
            {primaryCtaText}
          </Link>
          <Link href={`/${locale}/pricing`} className="secondary-button">
            {secondaryCtaText}
          </Link>
        </div>
        <div className="landing-proof">
          <span>项目中心</span>
          <span>中间工件</span>
          <span>剧本联动分镜</span>
          <span>浏览、下载、版本迭代</span>
        </div>
      </section>

      <section id="cases" className="feature-strip landing-case-strip">
        {dictionary.landing.bullets.map((bullet) => (
          <article key={bullet} className="feature-card">
            <span className="eyebrow">Case</span>
            <h2>{bullet}</h2>
            <p>从原文输入到分析、大纲、剧本和分镜，所有步骤都在项目里沉淀为可复用的资产。</p>
          </article>
        ))}
      </section>
    </div>
  );
}

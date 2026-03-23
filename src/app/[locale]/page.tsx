import Link from 'next/link';
import { getDictionary } from '@/i18n/get-dictionary';

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

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
          <Link href={`/${locale}/console`} className="primary-button">
            {dictionary.landing.primaryCta}
          </Link>
          <Link href={`/${locale}#cases`} className="secondary-button">
            {dictionary.landing.secondaryCta}
          </Link>
        </div>
        <div className="landing-proof">
          <span>AI 剧本</span>
          <span>分集大纲</span>
          <span>分镜提示</span>
          <span>无需登录即可先体验流程</span>
        </div>
      </section>

      <section id="cases" className="feature-strip landing-case-strip">
        {dictionary.landing.bullets.map((bullet) => (
          <article key={bullet} className="feature-card">
            <span className="eyebrow">Case</span>
            <h2>{bullet}</h2>
            <p>从原文输入、分析、大纲到剧本结果，直接进入控制台即可回放整个生成链路。</p>
          </article>
        ))}
      </section>
    </div>
  );
}

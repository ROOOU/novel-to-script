import Link from 'next/link';
import type { Dictionary } from '@/i18n/types';
import { PLAN_CATALOG_ENTRIES } from '@/server/billing/catalog';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface LandingPageProps {
  locale: SupportedLocale;
  dictionary: Pick<Dictionary, 'common' | 'landing' | 'pricingPage'>;
}

interface LandingFeature {
  eyebrow: string;
  title: string;
  body: string;
}

interface LandingStep {
  title: string;
  summary: string;
  tone: 'source' | 'analysis' | 'script' | 'storyboard';
}

export function LandingPage({ locale, dictionary }: LandingPageProps) {
  const isEnglish = locale === 'en-US';
  const primaryHref = `/${locale}/projects`;
  const signInHref = '/sign-in';
  const signUpHref = '/sign-up';
  const pricingHref = `/${locale}/pricing`;
  const primaryAction = isEnglish ? 'Open the studio' : '进入项目中心';
  const secondaryAction = isEnglish ? 'Create an account' : '注册并开始';
  const pricingAction = isEnglish ? 'Compare pricing' : '查看套餐';
  const boardTitle = isEnglish ? 'One project, every artifact in sequence.' : '一个项目里串起整条改编链路。';
  const boardBody = isEnglish
    ? 'Source text, analysis, outline, script, storyboard, and exports stay in one structured production record.'
    : '原文、分析、大纲、剧本、分镜和导出结果都沉淀在同一条制作记录里。';
  const finalTitle = isEnglish ? 'Start with a draft. Leave with deliverables.' : '从原文起步，把交付物留在项目里。';
  const finalBody = isEnglish
    ? 'NovelScript is built for creators who need to move from material intake to script and storyboard output without losing version history.'
    : 'NovelScript 面向需要快速把素材推进到剧本、分镜与版本交付的创作者，而不是只给你一个临时工具页。';

  const features = getLandingFeatures(locale, dictionary.landing.bullets);
  const steps = getLandingSteps(locale);
  const proofPoints = getProofPoints(locale);

  return (
    <div className="landing-page">
      <section className="landing-hero-panel">
        <div className="landing-hero-copy">
          <span className="eyebrow">{dictionary.landing.eyebrow}</span>
          <h1 className="landing-display">{dictionary.landing.title}</h1>
          <p className="landing-lead">{dictionary.landing.subtitle}</p>

          <div className="action-row landing-actions">
            <Link href={primaryHref} className="primary-button landing-primary-button">
              {primaryAction}
            </Link>
            <Link href={signUpHref} className="secondary-button landing-secondary-button">
              {secondaryAction}
            </Link>
            <Link href={pricingHref} className="text-link landing-text-link">
              {pricingAction}
            </Link>
          </div>

          <div className="landing-proof-strip" aria-label={isEnglish ? 'What the platform covers' : '平台能力范围'}>
            {proofPoints.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="landing-stage-panel" aria-label={isEnglish ? 'Workflow snapshot' : '流程概览'}>
          <div className="landing-stage-intro">
            <span className="eyebrow">{isEnglish ? 'Pipeline' : 'Pipeline'}</span>
            <h2>{boardTitle}</h2>
            <p>{boardBody}</p>
          </div>

          <div className="landing-stage-list">
            {steps.map((step, index) => (
              <article key={step.title} className={`landing-stage-card landing-stage-card-${step.tone}`}>
                <div className="landing-stage-index">0{index + 1}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-editorial-band" aria-label={isEnglish ? 'Positioning' : '产品定位'}>
        <div>
          <span className="eyebrow">{isEnglish ? 'Made for creators' : '为创作者准备'}</span>
          <p>
            {isEnglish
              ? 'Built for short-drama adaptation, AI video drafting, and production-minded iteration.'
              : '面向短剧改编、AI 视频起稿与需要持续迭代交付的制作流程。'}
          </p>
        </div>
        <div>
          <span className="eyebrow">{isEnglish ? 'Not a tool shelf' : '不是工具台'}</span>
          <p>
            {isEnglish
              ? 'Projects keep your source, jobs, artifacts, and exports in order instead of scattering them across isolated utilities.'
              : '项目把源文、任务、产物和导出集中管理，而不是把能力拆成分散的匿名工具。'}
          </p>
        </div>
      </section>

      <section className="landing-feature-grid">
        {features.map((feature) => (
          <article key={feature.title} className="landing-feature-card">
            <span className="eyebrow">{feature.eyebrow}</span>
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="landing-detail-grid">
        <article className="landing-detail-card landing-detail-card-wide">
          <span className="eyebrow">{isEnglish ? 'Production board' : '制作面板'}</span>
          <h2>{isEnglish ? 'Keep each output connected to the source that produced it.' : '让每份产物都能追溯到它的来源。'}</h2>
          <p>
            {isEnglish
              ? 'Version chains, export actions, and artifact relationships make handoff and revision less chaotic.'
              : '版本链、导出动作与产物关系让交接和迭代不再依赖手工整理。'}
          </p>
          <div className="landing-metadata-rail">
            <div>
              <strong>{isEnglish ? 'Source-first' : '源文先行'}</strong>
              <span>{isEnglish ? 'Save the original material once and reuse it across jobs.' : '保存一次原文，后续任务自动复用。'}</span>
            </div>
            <div>
              <strong>{isEnglish ? 'Artifact-aware' : '产物感知'}</strong>
              <span>{isEnglish ? 'Scripts and storyboards remain linked for downstream work.' : '剧本和分镜会保持上下游关联。'}</span>
            </div>
            <div>
              <strong>{isEnglish ? 'Export-ready' : '可直接交付'}</strong>
              <span>{isEnglish ? 'Download Markdown, JSON, or text packages when the project is ready.' : '项目成熟后可导出 Markdown、JSON 或文本包。'}</span>
            </div>
          </div>
        </article>

        <article className="landing-detail-card">
          <span className="eyebrow">{isEnglish ? 'Best fit' : '适合场景'}</span>
          <ul className="landing-list">
            <li>{dictionary.landing.bullets[0]}</li>
            <li>{dictionary.landing.bullets[1]}</li>
            <li>{dictionary.landing.bullets[2]}</li>
          </ul>
        </article>
      </section>

      <section className="landing-plan-preview">
        <div className="landing-section-heading">
          <span className="eyebrow">{dictionary.pricingPage.title}</span>
          <h2>{isEnglish ? 'Preview the plan ladder before you commit.' : '先看清套餐梯度，再决定如何启动。'}</h2>
          <p>{dictionary.pricingPage.billingHint}</p>
        </div>
        <div className="landing-plan-grid">
          {PLAN_CATALOG_ENTRIES.map((plan) => {
            const amountCents = plan.prices.USD.amountCents;
            const priceLabel = amountCents === 0 ? (isEnglish ? 'Free' : '免费') : formatUsd(amountCents);
            const badgeLabel =
              plan.key === 'creator' ? (isEnglish ? 'Recommended' : '推荐') : isEnglish ? 'Plan' : '方案';
            return (
              <article key={plan.key} className={`landing-plan-card ${plan.key === 'creator' ? 'featured' : ''}`}>
                <div className="landing-plan-top">
                  <h3>{plan.name[locale]}</h3>
                  <span>{badgeLabel}</span>
                </div>
                <strong className="landing-plan-price">
                  {priceLabel}
                  <small>{amountCents === 0 ? (isEnglish ? '/start' : '/起步') : '/mo'}</small>
                </strong>
                <p>{plan.description[locale]}</p>
                <div className="landing-plan-meta">
                  <span>{plan.monthlyCredits} {isEnglish ? 'credits / month' : '积分 / 月'}</span>
                  <span>{plan.entitlements.maxConcurrentJobs ?? 1} {isEnglish ? 'parallel jobs' : '并行任务'}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-cta-panel">
        <div>
          <span className="eyebrow">{isEnglish ? 'Ready to move' : '准备开始'}</span>
          <h2>{finalTitle}</h2>
          <p>{finalBody}</p>
        </div>
        <div className="action-row landing-actions landing-actions-compact">
          <Link href={signInHref} className="primary-button">
            {dictionary.common.signIn}
          </Link>
          <Link href={signUpHref} className="secondary-button">
            {dictionary.common.signUp}
          </Link>
        </div>
      </section>
    </div>
  );
}

function getLandingFeatures(locale: SupportedLocale, bullets: string[]): LandingFeature[] {
  if (locale === 'en-US') {
    return [
      {
        eyebrow: 'Workflow',
        title: 'Keep the pipeline readable from source intake to storyboard handoff.',
        body: bullets[0],
      },
      {
        eyebrow: 'Drafting',
        title: 'Generate scripts and storyboard prompts with project context still attached.',
        body: bullets[1],
      },
      {
        eyebrow: 'Operations',
        title: 'Price by credits, ship with exports, and keep every revision in one production space.',
        body: bullets[2],
      },
    ];
  }

  return [
    {
      eyebrow: 'Workflow',
      title: '让改编流程从原文输入到分镜交付都保持清晰可追踪。',
      body: bullets[0],
    },
    {
      eyebrow: 'Drafting',
      title: '在项目上下文里生成剧本和分镜提示，不再把素材拆散。',
      body: bullets[1],
    },
    {
      eyebrow: 'Operations',
      title: '用积分驱动生成、用导出沉淀交付、用版本链承接每次改稿。',
      body: bullets[2],
    },
  ];
}

function getLandingSteps(locale: SupportedLocale): LandingStep[] {
  if (locale === 'en-US') {
    return [
      {
        title: 'Source capture',
        summary: 'Bring the original novel text or adaptation brief into a durable project record.',
        tone: 'source',
      },
      {
        title: 'Analysis and outline',
        summary: 'Turn raw material into structured beats, episodes, and character logic.',
        tone: 'analysis',
      },
      {
        title: 'Script drafting',
        summary: 'Generate episode-ready scripts while preserving versions for revision cycles.',
        tone: 'script',
      },
      {
        title: 'Storyboard handoff',
        summary: 'Carry the approved script forward into storyboard generation and exports.',
        tone: 'storyboard',
      },
    ];
  }

  return [
    {
      title: '源文录入',
      summary: '把小说原文或改编需求先固定进项目，后续流程都围绕这份材料推进。',
      tone: 'source',
    },
    {
      title: '分析与分集',
      summary: '把原始素材整理成结构化分析、分集大纲和角色逻辑。',
      tone: 'analysis',
    },
    {
      title: '剧本起稿',
      summary: '生成可继续迭代的剧本版本，不丢失历史改稿脉络。',
      tone: 'script',
    },
    {
      title: '分镜衔接',
      summary: '从已确认剧本继续推到分镜与导出交付，避免重复整理素材。',
      tone: 'storyboard',
    },
  ];
}

function getProofPoints(locale: SupportedLocale): string[] {
  return locale === 'en-US'
    ? ['Project-based workflow', 'Version-aware artifacts', 'Credits and pricing', 'Script to storyboard handoff']
    : ['项目化工作流', '产物版本链', '积分与套餐', '剧本衔接分镜'];
}

function formatUsd(amountCents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

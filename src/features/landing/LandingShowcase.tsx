'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface LandingShowcaseProps {
  locale: SupportedLocale;
}

interface ShowcaseScene {
  id: string;
  tab: string;
  title: string;
  body: string;
  metric: string;
  images: Array<{
    src: string;
    alt: string;
    label: string;
  }>;
}

export function LandingShowcase({ locale }: LandingShowcaseProps) {
  const scenes = useMemo(() => getShowcaseScenes(locale), [locale]);
  const [activeSceneId, setActiveSceneId] = useState(scenes[0]?.id ?? 'canvas');
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0];
  const isEnglish = locale === 'en-US';

  if (!activeScene) {
    return null;
  }

  return (
    <section className="landing-showcase" aria-label={isEnglish ? 'Creative flow preview' : '创作流程预览'}>
      <div className="landing-showcase-header">
        <div>
          <span className="eyebrow">{isEnglish ? 'Production flow' : '制作流'}</span>
          <h2>{isEnglish ? 'Move from source to shot with the whole chain in view.' : '从原文推进到镜头，链路一直在眼前。'}</h2>
        </div>
        <p>
          {isEnglish
            ? 'Project context, story beats, storyboard outputs, and video clips stay close enough for fast decisions.'
            : '项目上下文、剧情节拍、分镜产物和视频片段保持在同一个创作节奏里。'}
        </p>
      </div>

      <div className="landing-showcase-stage">
        <div className="landing-showcase-copy">
          <span>{activeScene.metric}</span>
          <h3>{activeScene.title}</h3>
          <p>{activeScene.body}</p>
        </div>
        <div className="landing-showcase-rail" aria-live="polite">
          {activeScene.images.map((image) => (
            <figure key={`${activeScene.id}-${image.label}`} className="landing-showcase-frame">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 960px) 100vw, 28vw"
                unoptimized
              />
              <figcaption>{image.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="landing-showcase-tabs" role="tablist" aria-label={isEnglish ? 'Flow stage' : '流程阶段'}>
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            role="tab"
            aria-selected={activeScene.id === scene.id}
            className={`landing-showcase-tab ${activeScene.id === scene.id ? 'active' : ''}`}
            onClick={() => setActiveSceneId(scene.id)}
          >
            {scene.tab}
          </button>
        ))}
      </div>
    </section>
  );
}

function getShowcaseScenes(locale: SupportedLocale): ShowcaseScene[] {
  const images = {
    writingRoom: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80',
    cityNight: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80',
    filmCamera: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80',
    storyboard: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    neon: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
    editDesk: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    timeline: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80',
    studio: 'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=900&q=80',
    screen: 'https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=900&q=80',
  };

  if (locale === 'en-US') {
    return [
      {
        id: 'canvas',
        tab: 'Canvas',
        title: 'Gather the source, references, and structure before the first draft.',
        body: 'Every project begins as a production board, so the original material and the next generation step stay connected.',
        metric: 'Source intake',
        images: [
          { src: images.writingRoom, alt: 'Camera beside a writing desk', label: 'Source' },
          { src: images.cityNight, alt: 'Night city scene', label: 'Mood' },
          { src: images.filmCamera, alt: 'Film camera close-up', label: 'Shot logic' },
        ],
      },
      {
        id: 'copilot',
        tab: 'Copilot',
        title: 'Shape episodes, beats, and prompts without losing context.',
        body: 'Script, storyboard, and prompt-pack outputs are treated as one creative thread instead of separate files.',
        metric: 'Draft control',
        images: [
          { src: images.storyboard, alt: 'Cinematic outdoor frame', label: 'Beat' },
          { src: images.neon, alt: 'Desert road under dramatic light', label: 'Scene' },
          { src: images.editDesk, alt: 'Laptop workstation', label: 'Review' },
        ],
      },
      {
        id: 'compose',
        tab: 'Compose',
        title: 'Carry finished shots into video and delivery review.',
        body: 'Generated clips, exports, and artifact lineage stay ready for iteration as the short-drama package grows.',
        metric: 'Video handoff',
        images: [
          { src: images.timeline, alt: 'Night mountain sky', label: 'Tone' },
          { src: images.studio, alt: 'Cinema seats and screen', label: 'Preview' },
          { src: images.screen, alt: 'Production monitor desk', label: 'Delivery' },
        ],
      },
    ];
  }

  return [
    {
      id: 'canvas',
      tab: 'Canvas',
      title: '先把原文、参考和结构放进同一个生产板。',
      body: '每个项目从素材开始收束，原文、定位和下一步生成动作始终保持关联。',
      metric: '原文收口',
      images: [
        { src: images.writingRoom, alt: '写作桌旁的摄影机', label: '原文' },
        { src: images.cityNight, alt: '城市夜景', label: '情绪' },
        { src: images.filmCamera, alt: '电影摄影机特写', label: '镜头逻辑' },
      ],
    },
    {
      id: 'copilot',
      tab: 'Copilot',
      title: '在上下文里继续塑造集数、节拍和提示词。',
      body: '剧本、分镜和提示词包属于同一条创作线，不再被拆成零散文件。',
      metric: '底稿控制',
      images: [
        { src: images.storyboard, alt: '电影感户外画面', label: '节拍' },
        { src: images.neon, alt: '强光下的道路场景', label: '场景' },
        { src: images.editDesk, alt: '笔记本工作台', label: '复核' },
      ],
    },
    {
      id: 'compose',
      tab: 'Compose',
      title: '把确认后的镜头继续推进到视频和交付复看。',
      body: '生成片段、导出包和产物关系都留在项目里，方便继续迭代短剧成片。',
      metric: '视频交付',
      images: [
        { src: images.timeline, alt: '夜空下的山景', label: '调性' },
        { src: images.studio, alt: '影院座椅与银幕', label: '预览' },
        { src: images.screen, alt: '制作监看桌面', label: '交付' },
      ],
    },
  ];
}

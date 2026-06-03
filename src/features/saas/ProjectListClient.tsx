'use client';

import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  WorkspaceCapabilityCard,
  WorkspaceFeedback,
  WorkspaceFormActions,
  WorkspaceFormCard,
  WorkspaceFormHeader,
  WorkspaceHero,
  WorkspaceMetricCard,
} from '@/components/WorkspaceUI';
import { GENRE_LABELS, GENRE_LABELS_EN, GENRE_VALUES } from '@/lib/types';
import type { Project } from '@/server/shared/platform/domain';
import type { SupportedLocale } from '@/server/shared/platform/domain';
import { OnboardingChecklistPanel } from '@/features/saas/project/OnboardingChecklistPanel';
import { buildProjectsOnboardingSteps } from '@/features/saas/project/onboarding';

interface ProjectListClientProps {
  locale: SupportedLocale;
  projects: Project[];
  labels: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyBody: string;
    quickStartTitle: string;
    quickStartSubtitle: string;
    quickStartNote: string;
    quickStartCreateProjectTitle: string;
    quickStartCreateProjectDescription: string;
    quickStartSaveSourceTitle: string;
    quickStartSaveSourceDescription: string;
    quickStartGenerateScriptTitle: string;
    quickStartGenerateScriptDescription: string;
    quickStartGenerateStoryboardTitle: string;
    quickStartGenerateStoryboardDescription: string;
    createLabel: string;
    name: string;
    description: string;
    genre: string;
    lastUpdated: string;
    openWorkspace: string;
    openingWorkspace: string;
    deleteLabel: string;
    deletingLabel: string;
    deleteConfirmTitle: string;
    deleteConfirmBody: string;
    deleteError: string;
  };
}

export function ProjectListClient({ locale, projects: initialProjects, labels }: ProjectListClientProps) {
  const router = useRouter();
  const genreLabels = locale === 'en-US' ? GENRE_LABELS_EN : GENRE_LABELS;
  const [projects, setProjects] = useState(initialProjects);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('urban');
  const [submitting, setSubmitting] = useState(false);
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const quickStartSteps = buildProjectsOnboardingSteps({
    createProjectTitle: labels.quickStartCreateProjectTitle,
    createProjectDescription: labels.quickStartCreateProjectDescription,
    saveSourceTitle: labels.quickStartSaveSourceTitle,
    saveSourceDescription: labels.quickStartSaveSourceDescription,
    generateScriptTitle: labels.quickStartGenerateScriptTitle,
    generateScriptDescription: labels.quickStartGenerateScriptDescription,
    generateStoryboardTitle: labels.quickStartGenerateStoryboardTitle,
    generateStoryboardDescription: labels.quickStartGenerateStoryboardDescription,
  });
  const latestProject =
    [...projects].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )[0] ?? null;
  const activeProjectCount = projects.filter(
    (project) => Date.now() - new Date(project.updatedAt).getTime() <= 1000 * 60 * 60 * 24 * 14
  ).length;
  const genreCount = new Set(
    projects
      .map((project) => project.genre)
      .filter((value): value is (typeof GENRE_VALUES)[number] => Boolean(value))
  ).size;
  const overviewCards =
    locale === 'en-US'
      ? [
          {
            badge: '01',
            eyebrow: 'Source',
            title: 'Start every adaptation with one source thread',
            description:
              'A project keeps the original prose, positioning notes, and references together before script work begins.',
            tone: 'source',
            meta: [
              { label: 'Workspaces', value: `${projects.length}` },
              { label: 'Keeps', value: 'Source + references' },
            ],
          },
          {
            badge: '02',
            eyebrow: 'Script',
            title: 'Lock the dramatic rhythm before shots',
            description:
              'Script generation stays attached to the same project so pacing, character turns, and episode beats stay reviewable.',
            tone: 'script',
            meta: [
              { label: 'Purpose', value: 'Episode structure' },
              { label: 'Feeds', value: 'Storyboard and review' },
            ],
          },
          {
            badge: '03',
            eyebrow: 'Storyboard',
            title: 'Generate shots and prompt packs together',
            description:
              'Storyboard, shot plan, and Seedance prompt pack belong to one production moment, so this stage keeps them visible side by side.',
            tone: 'storyboard',
            meta: [
              { label: 'Outputs', value: 'Storyboard + shot plan' },
              { label: 'Prompting', value: 'Seedance ready' },
            ],
          },
          {
            badge: '04',
            eyebrow: 'Delivery',
            title: 'Carry the chain forward into exports',
            description:
              'The same workspace continues into video generation, artifact download, and delivery review instead of fragmenting across tools.',
            tone: 'delivery',
            meta: [
              { label: 'Next', value: 'Video and export' },
              { label: 'Archive', value: 'Artifacts stay linked' },
            ],
          },
        ]
      : [
          {
            badge: '01',
            eyebrow: '原文',
            title: '先把素材收进同一个项目',
            description: '每个短剧项目先沉淀原文、定位说明和参考资料，再继续进入后面的剧本与分镜流程。',
            tone: 'source',
            meta: [
              { label: '工作台', value: `${projects.length} 个项目` },
              { label: '沉淀', value: '原文与参考' },
            ],
          },
          {
            badge: '02',
            eyebrow: '剧本',
            title: '先把改编节奏固定下来',
            description: '剧本生成和编辑沿着同一条项目链路推进，人物走向、集数结构和转场节拍都更容易复核。',
            tone: 'script',
            meta: [
              { label: '目标', value: '剧情结构清晰' },
              { label: '衔接', value: '分镜前的底稿' },
            ],
          },
          {
            badge: '03',
            eyebrow: '分镜',
            title: '镜头计划和提示词包一起产出',
            description: '分镜、shot plan 和 Seedance prompt pack 归在同一次生产动作里，避免输出被拆散。',
            tone: 'storyboard',
            meta: [
              { label: '输出', value: '分镜 + shot plan' },
              { label: '提示词', value: 'Seedance 可直接用' },
            ],
          },
          {
            badge: '04',
            eyebrow: '交付',
            title: '继续走到导出与复盘',
            description: '同一个工作台还能接住视频生成、artifact 下载和交付复看，不用在多个页面之间来回切。',
            tone: 'delivery',
            meta: [
              { label: '下一步', value: '视频与导出' },
              { label: '保留', value: '产物持续关联' },
            ],
          },
        ];

  useEffect(() => {
    for (const project of projects) {
      router.prefetch(`/${locale}/projects/${project.id}`);
    }
  }, [locale, projects, router]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        genre,
      }),
    });
    const payload = await response.json();
    setSubmitting(false);
    if (!response.ok || !payload.project) {
      setErrorMessage(locale === 'en-US' ? 'Failed to create project.' : '创建项目失败，请稍后重试。');
      return;
    }

    setProjects((current) => [payload.project as Project, ...current]);
    setName('');
    setDescription('');
    startTransition(() => {
      router.push(`/${locale}/projects/${payload.project.id}`);
    });
  }

  function handleOpenProject(projectId: string) {
    setOpeningProjectId(projectId);
    setErrorMessage(null);
    startTransition(() => {
      router.push(`/${locale}/projects/${projectId}`);
    });
  }

  async function handleDeleteProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    const confirmed = window.confirm(
      `${labels.deleteConfirmTitle}\n\n${labels.deleteConfirmBody}\n\n${project?.name ?? projectId}`
    );
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(projectId);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'PROJECT_DELETE_FAILED');
      }

      setProjects((current) => current.filter((item) => item.id !== projectId));
      if (openingProjectId === projectId) {
        setOpeningProjectId(null);
      }
    } catch {
      setErrorMessage(labels.deleteError);
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <WorkspaceHero
        eyebrow={locale === 'en-US' ? 'Workspace' : '工作台'}
        title={labels.title}
        description={labels.subtitle}
        tags={[
          <span key="count" className="chip chip-count">
            {locale === 'en-US' ? `${projects.length} workspaces` : `${projects.length} 个项目工作台`}
          </span>,
          <span key="genres" className="chip chip-soft">
            {locale === 'en-US' ? `${genreCount} genre tracks` : `${genreCount} 条题材线`}
          </span>,
          latestProject ? (
            <span key="latest" className="chip">
              {locale === 'en-US' ? `Latest: ${latestProject.name}` : `最近更新：${latestProject.name}`}
            </span>
          ) : null,
        ].filter(Boolean)}
        aside={
          <>
          <WorkspaceMetricCard
            tone="matcha"
            label={locale === 'en-US' ? 'Projects' : '项目数'}
            value={projects.length}
          />
          <WorkspaceMetricCard
            tone="ube"
            label={locale === 'en-US' ? 'Active in 14 days' : '近 14 天活跃'}
            value={activeProjectCount}
          />
          <WorkspaceMetricCard
            tone="slushie"
            label={locale === 'en-US' ? 'Genres in play' : '题材线'}
            value={genreCount}
          />
          </>
        }
      />

      <section className="workspace-capability-grid">
        {overviewCards.map((card) => (
          <WorkspaceCapabilityCard
            key={`${card.badge}-${card.tone}`}
            tone={card.tone}
            eyebrow={card.eyebrow}
            title={card.title}
            badge={card.badge}
            description={card.description}
            meta={card.meta.map((item) => ({
              key: `${card.badge}-${item.label}`,
              label: item.label,
              value: item.value,
            }))}
          />
        ))}
      </section>

      <section className="workspace-grid">
        <WorkspaceFormCard as="form" className="project-create-card" onSubmit={handleCreate}>
          <WorkspaceFormHeader
            eyebrow={locale === 'en-US' ? 'New project' : '新建项目'}
            title={labels.createLabel}
            description={
              locale === 'en-US'
                ? 'Open a fresh workspace for one adaptation thread, then keep every source, script, and storyboard in one clear chain.'
                : '为一条改编线索开启新的工作空间，把原文、剧本和分镜都沉淀到同一条清晰链路里。'
            }
          />
          <label className="field">
            <span>{labels.name}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="field">
            <span>{labels.description}</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
          </label>
          <label className="field">
            <span>{labels.genre}</span>
            <select value={genre} onChange={(event) => setGenre(event.target.value)}>
              {GENRE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {genreLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <WorkspaceFormActions>
            <button type="submit" className="primary-button" disabled={submitting}>
              {labels.createLabel}
            </button>
          </WorkspaceFormActions>
          {errorMessage ? <WorkspaceFeedback tone="danger">{errorMessage}</WorkspaceFeedback> : null}
        </WorkspaceFormCard>

        <div className="stack-gap">
          {projects.length === 0 ? (
            <>
              <article className="card stack-gap-sm project-empty-card">
                <h2>{labels.emptyTitle}</h2>
                <p>{labels.emptyBody}</p>
              </article>
              <OnboardingChecklistPanel
                locale={locale}
                title={labels.quickStartTitle}
                subtitle={labels.quickStartSubtitle}
                steps={quickStartSteps}
                note={labels.quickStartNote}
              />
            </>
          ) : (
            <div className="project-list-grid">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className={`card project-card project-card-clay ${
                    openingProjectId === project.id ? 'project-card-pending' : ''
                  }`}
                  aria-busy={openingProjectId === project.id}
                >
                  <div className="project-card-top">
                    <div className="stack-gap-sm">
                      <h2>{project.name}</h2>
                      <p>{project.description || (locale === 'en-US' ? 'No description yet.' : '还没有项目说明。')}</p>
                    </div>
                    <span className="chip">{formatGenreLabel(locale, project.genre)}</span>
                  </div>
                  <div className="project-card-footer">
                    <small>
                      {labels.lastUpdated}: {new Date(project.updatedAt).toLocaleString(locale)}
                    </small>
                    <div className="project-card-actions">
                      <button
                        type="button"
                        className="ghost-button project-card-delete"
                        onClick={() => void handleDeleteProject(project.id)}
                        disabled={deletingProjectId === project.id || openingProjectId === project.id}
                      >
                        {deletingProjectId === project.id ? labels.deletingLabel : labels.deleteLabel}
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => handleOpenProject(project.id)}
                        disabled={deletingProjectId === project.id || openingProjectId === project.id}
                      >
                        {openingProjectId === project.id ? labels.openingWorkspace : labels.openWorkspace}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatGenreLabel(locale: SupportedLocale, genre?: string | null) {
  if (!genre || !GENRE_VALUES.includes(genre as (typeof GENRE_VALUES)[number])) {
    return locale === 'en-US' ? 'Genre type' : '题材类型';
  }

  const labels = locale === 'en-US' ? GENRE_LABELS_EN : GENRE_LABELS;
  return labels[genre as (typeof GENRE_VALUES)[number]];
}

'use client';

import { startTransition, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  };
}

export function ProjectListClient({ locale, projects: initialProjects, labels }: ProjectListClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('urban');
  const [submitting, setSubmitting] = useState(false);
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

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
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
      return;
    }

    setProjects((current) => [payload.project as Project, ...current]);
    setName('');
    setDescription('');
    startTransition(() => {
      router.push(`/${locale}/projects/${payload.project.id}`);
    });
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <section className="workspace-hero projects-hero">
        <div className="projects-hero-copy">
          <span className="eyebrow">{locale === 'en-US' ? 'Workspace' : '工作台'}</span>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <div className="projects-hero-aside">
          <div className="metric-card metric-card-matcha">
            <span>{locale === 'en-US' ? 'Projects' : '项目数'}</span>
            <strong>{projects.length}</strong>
          </div>
          <div className="metric-card metric-card-ube">
            <span>{locale === 'en-US' ? 'Workflow' : '流程'}</span>
            <strong>{locale === 'en-US' ? 'Source -> Script -> Storyboard' : '原文 -> 剧本 -> 分镜'}</strong>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <form className="card stack-gap project-create-card" onSubmit={handleCreate}>
          <div className="stack-gap-sm">
            <span className="eyebrow">{locale === 'en-US' ? 'New project' : '新建项目'}</span>
            <h2>{labels.createLabel}</h2>
            <p>
              {locale === 'en-US'
                ? 'Open a fresh workspace for one adaptation thread, then keep every source, script, and storyboard in one clear chain.'
                : '为一条改编线索开启新的工作空间，把原文、剧本和分镜都沉淀到同一条清晰链路里。'}
            </p>
          </div>
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
              <option value="urban">{locale === 'en-US' ? 'Urban romance' : '都市情感'}</option>
              <option value="xianxia">{locale === 'en-US' ? 'Xianxia' : '仙侠'}</option>
              <option value="fantasy">{locale === 'en-US' ? 'Fantasy adventure' : '奇幻冒险'}</option>
            </select>
          </label>
          <button type="submit" className="primary-button" disabled={submitting}>
            {labels.createLabel}
          </button>
        </form>

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
                <Link key={project.id} href={`/${locale}/projects/${project.id}`} className="card project-card project-card-clay">
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
                    <strong>{locale === 'en-US' ? 'Open workspace' : '进入工作台'}</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatGenreLabel(locale: SupportedLocale, genre?: string | null) {
  switch (genre) {
    case 'urban':
      return locale === 'en-US' ? 'Urban romance' : '都市情感';
    case 'xianxia':
      return locale === 'en-US' ? 'Xianxia' : '仙侠';
    case 'fantasy':
      return locale === 'en-US' ? 'Fantasy adventure' : '奇幻冒险';
    default:
      return locale === 'en-US' ? 'Genre' : '题材';
  }
}

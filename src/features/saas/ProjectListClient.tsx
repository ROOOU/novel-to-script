'use client';

import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
              {GENRE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {genreLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary-button" disabled={submitting}>
            {labels.createLabel}
          </button>
          {errorMessage ? <p className="helper-text">{errorMessage}</p> : null}
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

'use client';

import { startTransition, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Project } from '@/server/shared/platform/domain';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface ProjectListClientProps {
  locale: SupportedLocale;
  projects: Project[];
  labels: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyBody: string;
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
      <section className="workspace-hero">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
      </section>

      <section className="workspace-grid">
        <form className="card stack-gap" onSubmit={handleCreate}>
          <h2>{labels.createLabel}</h2>
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
              <option value="urban">urban</option>
              <option value="xianxia">xianxia</option>
              <option value="fantasy">fantasy</option>
            </select>
          </label>
          <button type="submit" className="primary-button" disabled={submitting}>
            {labels.createLabel}
          </button>
        </form>

        <div className="stack-gap">
          {projects.length === 0 ? (
            <article className="card">
              <h2>{labels.emptyTitle}</h2>
              <p>{labels.emptyBody}</p>
            </article>
          ) : (
            projects.map((project) => (
              <Link key={project.id} href={`/${locale}/projects/${project.id}`} className="card project-card">
                <div className="project-card-top">
                  <h2>{project.name}</h2>
                  <span className="chip">{project.genre ?? 'genre'}</span>
                </div>
                <p>{project.description || '...'}</p>
                <small>
                  {labels.lastUpdated}: {new Date(project.updatedAt).toLocaleString(locale)}
                </small>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

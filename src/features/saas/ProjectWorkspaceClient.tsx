'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  GenerationArtifact,
  GenerationJob,
  Project,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import { JobTimelinePanel } from '@/features/saas/project/JobTimelinePanel';
import { ProjectArtifactStudioPanel } from '@/features/saas/project/ProjectArtifactStudioPanel';
import { ProjectExportPanel } from '@/features/saas/project/ProjectExportPanel';
import { SourceEditorPanel } from '@/features/saas/project/SourceEditorPanel';

interface ProjectWorkspaceClientProps {
  locale: SupportedLocale;
  project: Project;
  initialSourceTitle: string;
  initialSourceText: string;
  jobs: GenerationJob[];
  artifacts: GenerationArtifact[];
  labels: {
    sourceTitle: string;
    sourceHint: string;
    saveSource: string;
    generateScript: string;
    generateStoryboard: string;
    latestJobs: string;
    latestArtifacts: string;
    sourceLabel: string;
    genre: string;
    episodeCount: string;
    episodeDuration: string;
    style: string;
    resultEmpty: string;
    backToProjects: string;
    editorView: string;
    jobsView: string;
    versionsView: string;
    resetDraft: string;
    saveVersion: string;
    versionHistory: string;
    basedOnVersion: string;
    createdAtLabel: string;
    changedLines: string;
    characterDelta: string;
    artifactStudioTitle: string;
    artifactStudioSubtitle: string;
    analysisTab: string;
    outlineTab: string;
    scriptTab: string;
    structuredHint: string;
    versionCount: string;
    parseError: string;
    rawContentLabel: string;
    rawContentHint: string;
    noArtifacts: string;
    noVersions: string;
    selectVersion: string;
    artifactTitleField: string;
    currentVersionLabel: string;
    latestVersionLabel: string;
    analysisEditorTitle: string;
    analysisTitleField: string;
    analysisGenreField: string;
    plotSummaryField: string;
    keyConflictsField: string;
    climaxPointsField: string;
    emotionalBeatsField: string;
    charactersField: string;
    addCharacter: string;
    removeCharacter: string;
    characterName: string;
    characterDescription: string;
    characterPersonality: string;
    characterSpeechStyle: string;
    characterRelationships: string;
    outlineEditorTitle: string;
    outlineEpisodeNumber: string;
    outlineTitleField: string;
    outlineSummaryField: string;
    outlineKeyEventsField: string;
    outlineHookField: string;
    addEpisode: string;
    removeEpisode: string;
    scriptEditorTitle: string;
    scriptContentField: string;
    scriptHint: string;
    exportsTitle: string;
    exportsSubtitle: string;
    exportMarkdown: string;
    exportJson: string;
    exportText: string;
    latestExports: string;
    downloadExport: string;
  };
}

export function ProjectWorkspaceClient({
  locale,
  project,
  initialSourceTitle,
  initialSourceText,
  jobs: initialJobs,
  artifacts: initialArtifacts,
  labels,
}: ProjectWorkspaceClientProps) {
  const [activeView, setActiveView] = useState<'editor' | 'jobs' | 'versions'>('editor');
  const [sourceTitle, setSourceTitle] = useState(initialSourceTitle);
  const [sourceText, setSourceText] = useState(initialSourceText);
  const [jobs, setJobs] = useState(initialJobs);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [genre, setGenre] = useState(project.genre ?? 'urban');
  const [episodeCount, setEpisodeCount] = useState(5);
  const [episodeDuration, setEpisodeDuration] = useState('1:30-2:00');
  const [style, setStyle] = useState('dramatic');
  const [saving, setSaving] = useState(false);
  const [runningKind, setRunningKind] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latestScriptText = useMemo(() => {
    return artifacts
      .filter((artifact) => artifact.kind === 'script')
      .sort((left, right) => left.version - right.version)
      .map((artifact) => artifact.content ?? '')
      .join('\n\n');
  }, [artifacts]);

  const hasActiveJobs = jobs.some((job) => job.status === 'queued' || job.status === 'running');

  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/projects/${project.id}`);
      const payload = await response.json();
      if (!payload.ok) {
        return;
      }
      setJobs(payload.jobs);
      setArtifacts(payload.artifacts);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [hasActiveJobs, project.id]);

  async function refreshProjectBundle() {
    const response = await fetch(`/api/projects/${project.id}`);
    const payload = await response.json();
    if (payload.ok) {
      setJobs(payload.jobs);
      setArtifacts(payload.artifacts);
    }
  }

  async function handleSaveSource() {
    setSaving(true);
    const response = await fetch(`/api/projects/${project.id}/source`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: sourceTitle || project.name,
        textContent: sourceText,
      }),
    });
    const payload = await response.json();
    setSaving(false);
    setMessage(payload.ok ? labels.saveSource : payload.error);
  }

  async function handleRunScript() {
    setRunningKind('script');
    const response = await fetch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'script-generation',
        payload: {
          text: sourceText,
          genre,
          config: {
            genre,
            episodeCount,
            episodeDuration,
            style,
            includeDirectorNotes: true,
          },
        },
      }),
    });
    const payload = await response.json();
    setRunningKind(null);
    setMessage(payload.ok ? labels.generateScript : payload.error);
    if (payload.ok) {
      startTransition(() => {
        void refreshProjectBundle();
      });
    }
  }

  async function handleRunStoryboard() {
    setRunningKind('storyboard');
    const response = await fetch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'storyboard-generation',
        payload: {
          scriptText: latestScriptText,
          visualStyle: locale === 'en-US' ? 'cinematic realism' : '真人写实',
          colorTone: locale === 'en-US' ? 'warm tone' : '暖色调',
          genreLabel: genre,
        },
      }),
    });
    const payload = await response.json();
    setRunningKind(null);
    setMessage(payload.ok ? labels.generateStoryboard : payload.error);
    if (payload.ok) {
      startTransition(() => {
        void refreshProjectBundle();
      });
    }
  }

  return (
    <div className="workspace-shell stack-gap-lg">
      <section className="workspace-hero">
        <div>
          <a href={`/${locale}/projects`} className="inline-link">{labels.backToProjects}</a>
          <h1>{project.name}</h1>
          <p>{project.description || labels.sourceHint}</p>
        </div>
      </section>

      <section className="segmented-control">
        <button type="button" className={`segment ${activeView === 'editor' ? 'active' : ''}`} onClick={() => setActiveView('editor')}>
          {labels.editorView}
        </button>
        <button type="button" className={`segment ${activeView === 'jobs' ? 'active' : ''}`} onClick={() => setActiveView('jobs')}>
          {labels.jobsView}
        </button>
        <button type="button" className={`segment ${activeView === 'versions' ? 'active' : ''}`} onClick={() => setActiveView('versions')}>
          {labels.versionsView}
        </button>
      </section>

      <section className="workspace-grid">
        {activeView === 'editor' ? (
          <>
            <SourceEditorPanel
              labels={labels}
              sourceTitle={sourceTitle}
              sourceText={sourceText}
              genre={genre}
              episodeCount={episodeCount}
              episodeDuration={episodeDuration}
              style={style}
              message={message}
              saving={saving}
              runningKind={runningKind}
              canGenerateStoryboard={Boolean(latestScriptText.trim())}
              onSourceTitleChange={setSourceTitle}
              onSourceTextChange={setSourceText}
              onGenreChange={setGenre}
              onEpisodeCountChange={setEpisodeCount}
              onEpisodeDurationChange={setEpisodeDuration}
              onStyleChange={setStyle}
              onSaveSource={handleSaveSource}
              onRunScript={handleRunScript}
              onRunStoryboard={handleRunStoryboard}
            />
            <ProjectArtifactStudioPanel
              locale={locale}
              title={labels.artifactStudioTitle}
              subtitle={labels.artifactStudioSubtitle}
              artifacts={artifacts.filter((artifact) => artifact.kind !== 'export')}
              labels={labels}
              onVersionSaved={refreshProjectBundle}
            />
          </>
        ) : null}

        {activeView === 'jobs' ? (
          <>
            <JobTimelinePanel title={labels.latestJobs} jobs={jobs} />
            <ProjectArtifactStudioPanel
              locale={locale}
              title={labels.artifactStudioTitle}
              subtitle={labels.artifactStudioSubtitle}
              artifacts={artifacts.filter((artifact) => artifact.kind !== 'export')}
              labels={labels}
              onVersionSaved={refreshProjectBundle}
            />
          </>
        ) : null}

        {activeView === 'versions' ? (
          <>
            <ProjectArtifactStudioPanel
              locale={locale}
              title={labels.artifactStudioTitle}
              subtitle={labels.artifactStudioSubtitle}
              artifacts={artifacts.filter((artifact) => artifact.kind !== 'export')}
              labels={labels}
              onVersionSaved={refreshProjectBundle}
            />
            <ProjectExportPanel
              projectId={project.id}
              title={labels.exportsTitle}
              subtitle={labels.exportsSubtitle}
              markdownLabel={labels.exportMarkdown}
              jsonLabel={labels.exportJson}
              textLabel={labels.exportText}
              latestExportsLabel={labels.latestExports}
              downloadLabel={labels.downloadExport}
              exports={artifacts.filter((artifact) => artifact.kind === 'export')}
              onExportCreated={refreshProjectBundle}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

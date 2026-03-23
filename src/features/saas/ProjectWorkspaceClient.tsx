'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  ArtifactRelation,
  GenerationArtifact,
  GenerationJob,
  Project,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import { AssetBrowserPanel } from '@/features/saas/project/AssetBrowserPanel';
import { JobTimelinePanel } from '@/features/saas/project/JobTimelinePanel';
import { PipelineProgressBar, type PipelineStageItem } from '@/features/saas/project/PipelineProgressBar';
import { ProjectArtifactStudioPanel } from '@/features/saas/project/ProjectArtifactStudioPanel';
import { ProjectExportPanel } from '@/features/saas/project/ProjectExportPanel';
import { SourceEditorPanel } from '@/features/saas/project/SourceEditorPanel';
import { StoryboardPanel } from '@/features/saas/project/StoryboardPanel';

type WorkspaceTab = 'source' | 'analysis' | 'outline' | 'script' | 'storyboard' | 'exports' | 'jobs';

interface ProjectWorkspaceClientProps {
  locale: SupportedLocale;
  project: Project;
  initialSourceTitle: string;
  initialSourceText: string;
  jobs: GenerationJob[];
  artifacts: GenerationArtifact[];
  artifactRelations: ArtifactRelation[];
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
  artifactRelations: initialArtifactRelations,
  labels,
}: ProjectWorkspaceClientProps) {
  const copy = getWorkspaceCopy(locale);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('source');
  const [sourceTitle, setSourceTitle] = useState(initialSourceTitle);
  const [sourceText, setSourceText] = useState(initialSourceText);
  const [jobs, setJobs] = useState(initialJobs);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [artifactRelations, setArtifactRelations] = useState(initialArtifactRelations);
  const [selectedScriptArtifactId, setSelectedScriptArtifactId] = useState<string | null>(null);
  const [genre, setGenre] = useState(project.genre ?? 'urban');
  const [episodeCount, setEpisodeCount] = useState(5);
  const [episodeDuration, setEpisodeDuration] = useState('1:30-2:00');
  const [style, setStyle] = useState('dramatic');
  const [saving, setSaving] = useState(false);
  const [runningKind, setRunningKind] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hasActiveJobs = jobs.some((job) => job.status === 'queued' || job.status === 'running');
  const latestScriptArtifact = useMemo(() => {
    return [...artifacts]
      .filter((artifact) => artifact.kind === 'script')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.version - left.version)[0] ?? null;
  }, [artifacts]);
  const pipelineStages = useMemo(
    () => derivePipelineStages(sourceText, artifacts, jobs, latestScriptArtifact),
    [artifacts, jobs, latestScriptArtifact, sourceText]
  );

  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const timer = window.setInterval(() => {
      startTransition(() => {
        void refreshProjectBundle();
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [hasActiveJobs, project.id]);

  async function refreshProjectBundle() {
    const response = await fetch(`/api/projects/${project.id}`);
    const payload = await response.json();
    if (payload.ok) {
      setJobs(payload.jobs);
      setArtifacts(payload.artifacts);
      setArtifactRelations(payload.artifactRelations ?? []);
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
      setActiveTab('jobs');
      startTransition(() => {
        void refreshProjectBundle();
      });
    }
  }

  async function handleRunPipeline() {
    setRunningKind('pipeline');
    const response = await fetch(`/api/projects/${project.id}/pipelines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'novel-to-storyboard',
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
          storyboardConfig: {
            visualStyle: locale === 'en-US' ? 'cinematic realism' : '真人写实',
            colorTone: locale === 'en-US' ? 'warm tone' : '暖色调',
            genreLabel: genre,
          },
        },
      }),
    });
    const payload = await response.json();
    setRunningKind(null);
    setMessage(payload.ok ? copy.pipelineStarted : payload.error);
    if (payload.ok) {
      setActiveTab('jobs');
      startTransition(() => {
        void refreshProjectBundle();
      });
    }
  }

  async function handleRunStoryboardFromArtifact(artifact: GenerationArtifact) {
    setSelectedScriptArtifactId(artifact.id);
    setRunningKind('storyboard');
    const response = await fetch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'storyboard-generation',
        payload: {
          scriptArtifactIds: [artifact.id],
          visualStyle: locale === 'en-US' ? 'cinematic realism' : '真人写实',
          colorTone: locale === 'en-US' ? 'warm tone' : '暖色调',
          genreLabel: genre,
        },
      }),
    });
    const payload = await response.json();
    setRunningKind(null);
    setMessage(payload.ok ? copy.storyboardStarted : payload.error);
    if (payload.ok) {
      setActiveTab('storyboard');
      startTransition(() => {
        void refreshProjectBundle();
      });
    }
  }

  async function handleJobAction(job: GenerationJob, action: 'retry' | 'cancel') {
    const response = await fetch(`/api/projects/${project.id}/jobs/${job.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `${action.toUpperCase()}_FAILED`);
    }

    await refreshProjectBundle();
  }

  function handleSelectStoryboardSourceArtifact(artifactId: string) {
    setSelectedScriptArtifactId(artifactId);
    setActiveTab('script');
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

      <PipelineProgressBar
        title={copy.pipelineTitle}
        subtitle={copy.pipelineSubtitle}
        stages={pipelineStages}
        jobs={jobs}
      />

      <section className="segmented-control">
        {[
          { id: 'source', label: copy.sourceTab },
          { id: 'analysis', label: labels.analysisTab },
          { id: 'outline', label: labels.outlineTab },
          { id: 'script', label: labels.scriptTab },
          { id: 'storyboard', label: copy.storyboardTab },
          { id: 'exports', label: copy.exportsTab },
          { id: 'jobs', label: copy.jobsTab },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`segment ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as WorkspaceTab)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === 'source' ? (
        <section className="workspace-grid">
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
            pipelineActionLabel={copy.pipelineAction}
            onSourceTitleChange={setSourceTitle}
            onSourceTextChange={setSourceText}
            onGenreChange={setGenre}
            onEpisodeCountChange={setEpisodeCount}
            onEpisodeDurationChange={setEpisodeDuration}
            onStyleChange={setStyle}
            onSaveSource={handleSaveSource}
            onRunScript={handleRunScript}
            onRunPipeline={handleRunPipeline}
          />
          <AssetBrowserPanel
            title={copy.assetsTitle}
            subtitle={copy.assetsSubtitle}
            artifacts={artifacts.filter((artifact) => artifact.kind !== 'export')}
            artifactRelations={artifactRelations}
            jobs={jobs}
          />
        </section>
      ) : null}

      {activeTab === 'analysis' ? (
        <ProjectArtifactStudioPanel
          locale={locale}
          title={labels.analysisTab}
          subtitle={labels.artifactStudioSubtitle}
          artifacts={artifacts}
          allowedKinds={['analysis']}
          initialKind="analysis"
          hideKindTabs
          labels={labels}
          onVersionSaved={refreshProjectBundle}
        />
      ) : null}

      {activeTab === 'outline' ? (
        <ProjectArtifactStudioPanel
          locale={locale}
          title={labels.outlineTab}
          subtitle={labels.artifactStudioSubtitle}
          artifacts={artifacts}
          allowedKinds={['outline']}
          initialKind="outline"
          hideKindTabs
          labels={labels}
          onVersionSaved={refreshProjectBundle}
        />
      ) : null}

      {activeTab === 'script' ? (
        <ProjectArtifactStudioPanel
          locale={locale}
          title={labels.scriptTab}
          subtitle={copy.scriptSubtitle}
          artifacts={artifacts}
          allowedKinds={['script']}
          initialKind="script"
          hideKindTabs
          scriptPrimaryActionLabel={copy.storyboardFromVersion}
          onRunScriptPrimaryAction={handleRunStoryboardFromArtifact}
          selectedArtifactId={selectedScriptArtifactId}
          labels={labels}
          onVersionSaved={refreshProjectBundle}
        />
      ) : null}

      {activeTab === 'storyboard' ? (
        <StoryboardPanel
          title={copy.storyboardTab}
          subtitle={copy.storyboardSubtitle}
          artifacts={artifacts}
          artifactRelations={artifactRelations}
          jobs={jobs}
          onSelectSourceArtifact={handleSelectStoryboardSourceArtifact}
        />
      ) : null}

      {activeTab === 'exports' ? (
        <section className="workspace-grid">
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
          <AssetBrowserPanel
            title={copy.assetsTitle}
            subtitle={copy.assetsSubtitle}
            artifacts={artifacts}
            artifactRelations={artifactRelations}
            jobs={jobs}
          />
        </section>
      ) : null}

      {activeTab === 'jobs' ? (
        <JobTimelinePanel
          title={labels.latestJobs}
          subtitle={copy.jobsSubtitle}
          jobs={jobs}
          pipelineStages={pipelineStages}
          onRetryJob={(job) => handleJobAction(job, 'retry')}
          onCancelJob={(job) => handleJobAction(job, 'cancel')}
        />
      ) : null}
    </div>
  );
}

function derivePipelineStages(
  sourceText: string,
  artifacts: GenerationArtifact[],
  jobs: GenerationJob[],
  latestScriptArtifact: GenerationArtifact | null
): PipelineStageItem[] {
  const latestScriptJob = [...jobs]
    .filter((job) => job.kind === 'script-generation')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  const latestStoryboardJob = [...jobs]
    .filter((job) => job.kind === 'storyboard-generation')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

  return [
    {
      id: 'source',
      title: 'Source',
      status: sourceText.trim() ? 'succeeded' : 'pending',
      summary: sourceText.trim() ? `${sourceText.length} chars ready` : 'Source text required',
    },
    {
      id: 'analysis',
      title: 'Analysis',
      status: deriveStageStatus('analysis', artifacts, latestScriptJob),
      summary: summarizeArtifacts('analysis', artifacts, latestScriptJob),
      jobId: latestScriptJob?.id ?? null,
      artifactId: latestArtifactId('analysis', artifacts),
    },
    {
      id: 'outline',
      title: 'Outline',
      status: deriveStageStatus('outline', artifacts, latestScriptJob),
      summary: summarizeArtifacts('outline', artifacts, latestScriptJob),
      jobId: latestScriptJob?.id ?? null,
      artifactId: latestArtifactId('outline', artifacts),
    },
    {
      id: 'script',
      title: 'Script',
      status: deriveStageStatus('script', artifacts, latestScriptJob),
      summary: summarizeArtifacts('script', artifacts, latestScriptJob),
      jobId: latestScriptJob?.id ?? null,
      artifactId: latestScriptArtifact?.id ?? null,
    },
    {
      id: 'storyboard',
      title: 'Storyboard',
      status: deriveStageStatus('storyboard', artifacts, latestStoryboardJob),
      summary: summarizeArtifacts('storyboard', artifacts, latestStoryboardJob),
      jobId: latestStoryboardJob?.id ?? null,
      artifactId: latestArtifactId('storyboard', artifacts),
    },
  ];
}

function deriveStageStatus(
  kind: 'analysis' | 'outline' | 'script' | 'storyboard',
  artifacts: GenerationArtifact[],
  job: GenerationJob | null
): PipelineStageItem['status'] {
  const hasArtifacts = artifacts.some((artifact) => artifact.kind === kind);
  if (hasArtifacts) {
    return 'succeeded';
  }

  if (!job) {
    return 'pending';
  }

  if (job.status === 'queued') {
    return 'queued';
  }

  if (job.status === 'cancelled') {
    return 'cancelled';
  }

  if (job.status === 'failed') {
    return kind === 'storyboard' || stageReachedInScriptJob(kind, job.currentStep) ? 'failed' : 'pending';
  }

  if (job.status === 'running') {
    if (kind === 'storyboard') {
      return 'running';
    }

    return stageReachedInScriptJob(kind, job.currentStep) ? 'running' : 'pending';
  }

  return 'pending';
}

function stageReachedInScriptJob(
  kind: 'analysis' | 'outline' | 'script',
  currentStep?: string | null
) {
  if (!currentStep) {
    return kind === 'analysis';
  }

  if (kind === 'analysis') {
    return ['preprocessing', 'analyzing', 'analyzed', 'outlining', 'outlined', 'generating', 'done'].includes(currentStep)
      || currentStep.startsWith('generating_episode_');
  }

  if (kind === 'outline') {
    return ['outlining', 'outlined', 'generating', 'done'].includes(currentStep)
      || currentStep.startsWith('generating_episode_');
  }

  return currentStep === 'generating' || currentStep === 'done' || currentStep.startsWith('generating_episode_');
}

function summarizeArtifacts(
  kind: 'analysis' | 'outline' | 'script' | 'storyboard',
  artifacts: GenerationArtifact[],
  job: GenerationJob | null
) {
  const matchingArtifacts = artifacts.filter((artifact) => artifact.kind === kind);
  if (matchingArtifacts.length > 0) {
    return `${matchingArtifacts.length} artifact${matchingArtifacts.length === 1 ? '' : 's'}`;
  }

  if (job?.currentStep) {
    return job.currentStep;
  }

  return 'Pending';
}

function latestArtifactId(kind: GenerationArtifact['kind'], artifacts: GenerationArtifact[]) {
  return [...artifacts]
    .filter((artifact) => artifact.kind === kind)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.version - left.version)[0]?.id ?? null;
}

function getWorkspaceCopy(locale: SupportedLocale) {
  if (locale === 'en-US') {
    return {
      sourceTab: 'Source',
      storyboardTab: 'Storyboard',
      exportsTab: 'Exports',
      jobsTab: 'Jobs',
      pipelineTitle: 'Pipeline Progress',
      pipelineSubtitle: 'Track the current stage from source to storyboard.',
      pipelineAction: 'Generate storyboard end-to-end',
      pipelineStarted: 'Pipeline started',
      storyboardStarted: 'Storyboard job created',
      storyboardFromVersion: 'Generate storyboard from this version',
      storyboardSubtitle: 'Inspect storyboard versions, downloads, and source links.',
      scriptSubtitle: 'Edit script versions and continue into storyboard generation.',
      assetsTitle: 'Asset Browser',
      assetsSubtitle: 'Browse, filter, and download every project artifact.',
      jobsSubtitle: 'Queued, running, failed, and completed generation jobs.',
    };
  }

  return {
    sourceTab: '原文',
    storyboardTab: '分镜',
    exportsTab: '导出',
    jobsTab: '任务',
    pipelineTitle: '流程进度',
    pipelineSubtitle: '跟踪当前项目从原文到分镜的阶段状态。',
    pipelineAction: '一键生成分镜',
    pipelineStarted: '已启动一键生成分镜流程',
    storyboardStarted: '已创建分镜任务',
    storyboardFromVersion: '从此版本生成分镜',
    storyboardSubtitle: '浏览分镜版本、下载结果和来源关系。',
    scriptSubtitle: '编辑剧本版本，并从指定版本继续生成分镜。',
    assetsTitle: '资产浏览器',
    assetsSubtitle: '统一筛选、预览和下载项目内全部资产。',
    jobsSubtitle: '查看排队、运行、失败和完成的生成任务。',
  };
}

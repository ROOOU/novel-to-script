'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { SUPPORTED_TEXT_FILE_ACCEPT } from '@/lib/file-text';
import { GENRE_LABELS, GENRE_LABELS_EN, GENRE_VALUES } from '@/lib/types';
import type {
  ArtifactRelation,
  GenerationArtifact,
  GenerationJob,
  Project,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import { AssetBrowserPanel } from '@/features/saas/project/AssetBrowserPanel';
import { JobTimelinePanel } from '@/features/saas/project/JobTimelinePanel';
import { OnboardingChecklistPanel } from '@/features/saas/project/OnboardingChecklistPanel';
import {
  PipelineProgressBar,
  type PipelineStageStatus,
} from '@/features/saas/project/PipelineProgressBar';
import { deriveProjectPipelineStages } from '@/features/saas/project/pipeline-state';
import { ProjectArtifactStudioPanel } from '@/features/saas/project/ProjectArtifactStudioPanel';
import { ProjectExportPanel } from '@/features/saas/project/ProjectExportPanel';
import { SourceEditorPanel } from '@/features/saas/project/SourceEditorPanel';
import { StoryboardGenerationPanel } from '@/features/saas/project/StoryboardGenerationPanel';
import { StoryboardPanel } from '@/features/saas/project/StoryboardPanel';
import {
  buildStoryboardGenerationPayload,
  deriveDefaultStoryboardSourceArtifactIds,
  deriveStoryboardScopeEpisodeOptions,
  deriveStoryboardScopeSceneOptions,
  deriveStoryboardScopeSourceOptions,
} from '@/features/saas/project/storyboard-scope';
import { buildProjectWorkspaceOnboardingSteps } from '@/features/saas/project/onboarding';

type WorkspaceTab = 'source' | 'analysis' | 'outline' | 'script' | 'storyboard' | 'exports' | 'jobs';
type WorkflowStageId = 'novel' | 'script' | 'storyboard';

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
    uploadSource: string;
    uploadHint: string;
    saveSource: string;
    generateScript: string;
    generateStoryboard: string;
    sourceActionHint: string;
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
    onboardingTitle: string;
    onboardingSubtitle: string;
    onboardingNote: string;
    onboardingSaveSourceTitle: string;
    onboardingSaveSourceDescription: string;
    onboardingGenerateScriptTitle: string;
    onboardingGenerateScriptDescription: string;
    onboardingGenerateStoryboardTitle: string;
    onboardingGenerateStoryboardDescription: string;
    onboardingOpenScriptTab: string;
    onboardingOpenStoryboardTab: string;
    storyboardScopeTitle: string;
    storyboardScopeHint: string;
    storyboardSourceVersions: string;
    storyboardUseLatestVersions: string;
    storyboardEpisodeFilter: string;
    storyboardEpisodeFilterHint: string;
    storyboardSceneFilter: string;
    storyboardSceneFilterHint: string;
    storyboardNoScripts: string;
    storyboardNoEpisodes: string;
    storyboardNoScenes: string;
    storyboardClearFilters: string;
    storyboardGenerateSelected: string;
    storyboardVersionPrefix: string;
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
  const projectRefreshInFlightRef = useRef(false);
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
  const [uploadingSource, setUploadingSource] = useState(false);
  const [runningKind, setRunningKind] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const storyboardScopeSourceOptions = useMemo(
    () => deriveStoryboardScopeSourceOptions(artifacts),
    [artifacts]
  );
  const defaultStoryboardSourceArtifactIds = useMemo(
    () => deriveDefaultStoryboardSourceArtifactIds(storyboardScopeSourceOptions),
    [storyboardScopeSourceOptions]
  );
  const [storyboardSourceArtifactIds, setStoryboardSourceArtifactIds] = useState<string[]>(
    defaultStoryboardSourceArtifactIds
  );
  const [storyboardEpisodeNumbers, setStoryboardEpisodeNumbers] = useState<number[]>([]);
  const [storyboardSceneIds, setStoryboardSceneIds] = useState<string[]>([]);
  const storyboardEpisodeOptions = useMemo(
    () =>
      deriveStoryboardScopeEpisodeOptions(
        storyboardScopeSourceOptions,
        storyboardSourceArtifactIds
      ),
    [storyboardScopeSourceOptions, storyboardSourceArtifactIds]
  );
  const storyboardSceneOptions = useMemo(
    () =>
      deriveStoryboardScopeSceneOptions(
        storyboardScopeSourceOptions,
        storyboardSourceArtifactIds
      ),
    [storyboardScopeSourceOptions, storyboardSourceArtifactIds]
  );

  const hasActiveJobs = jobs.some((job) => job.status === 'queued' || job.status === 'running');
  const sourceTabArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind !== 'export'),
    [artifacts]
  );
  const pipelineStages = useMemo(
    () => deriveProjectPipelineStages(locale, sourceText, artifacts, jobs),
    [artifacts, jobs, locale, sourceText]
  );
  const failedPipelineStage = useMemo(
    () => pipelineStages.find((stage) => stage.status === 'failed') ?? null,
    [pipelineStages]
  );
  const onboardingSteps = useMemo(
    () =>
      buildProjectWorkspaceOnboardingSteps({
        locale,
        sourceText,
        artifacts,
        jobs,
        labels: {
          createProjectTitle: '',
          createProjectDescription: '',
          saveSourceTitle: labels.onboardingSaveSourceTitle,
          saveSourceDescription: labels.onboardingSaveSourceDescription,
          generateScriptTitle: labels.onboardingGenerateScriptTitle,
          generateScriptDescription: labels.onboardingGenerateScriptDescription,
          generateStoryboardTitle: labels.onboardingGenerateStoryboardTitle,
          generateStoryboardDescription: labels.onboardingGenerateStoryboardDescription,
        },
      }),
    [artifacts, jobs, labels, locale, sourceText]
  );
  const shouldShowWorkspaceOnboarding = onboardingSteps.some(
    (step) => step.tone !== 'completed'
  );
  const scriptArtifacts = artifacts.filter((artifact) => artifact.kind === 'script');
  const storyboardArtifacts = artifacts.filter((artifact) => artifact.kind === 'storyboard');
  const exportArtifacts = artifacts.filter((artifact) => artifact.kind === 'export');
  const completedJobs = jobs.filter((job) => job.status === 'succeeded');
  const latestJob = jobs[0] ?? null;
  const activeWorkflowStage = getWorkflowStageFromTab(activeTab);
  const workflowStages = useMemo(
    () =>
      buildWorkflowStages(locale, {
        pipelineStages,
        sourceText,
        scriptArtifacts,
        storyboardArtifacts,
        jobs,
      }),
    [jobs, locale, pipelineStages, scriptArtifacts, sourceText, storyboardArtifacts]
  );
  const workflowSubtabs = getWorkflowSubtabs(locale, labels, activeWorkflowStage);
  const workspaceOnboardingAction = useMemo(() => {
    const hasStoryboardArtifact = artifacts.some((artifact) => artifact.kind === 'storyboard');
    if (hasStoryboardArtifact) {
      return {
        label: labels.onboardingOpenStoryboardTab,
        onClick: () => setActiveTab('storyboard'),
      };
    }

    const hasScriptArtifact = artifacts.some((artifact) => artifact.kind === 'script');
    if (hasScriptArtifact) {
      return {
        label: labels.onboardingOpenScriptTab,
        onClick: () => setActiveTab('script'),
      };
    }

    return null;
  }, [artifacts, labels.onboardingOpenScriptTab, labels.onboardingOpenStoryboardTab]);

  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || projectRefreshInFlightRef.current) {
        return;
      }

      startTransition(() => {
        void refreshProjectBundle();
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [hasActiveJobs, project.id]);

  useEffect(() => {
    setStoryboardSourceArtifactIds((currentIds) => {
      const availableArtifactIdSet = new Set(
        storyboardScopeSourceOptions.map((option) => option.artifactId)
      );
      const nextIds = currentIds.filter((artifactId) =>
        availableArtifactIdSet.has(artifactId)
      );

      if (nextIds.length > 0) {
        return nextIds;
      }

      return defaultStoryboardSourceArtifactIds;
    });
  }, [defaultStoryboardSourceArtifactIds, storyboardScopeSourceOptions]);

  useEffect(() => {
    const availableEpisodeSet = new Set(storyboardEpisodeOptions);
    setStoryboardEpisodeNumbers((currentEpisodes) =>
      currentEpisodes.filter((episodeNumber) => availableEpisodeSet.has(episodeNumber))
    );
  }, [storyboardEpisodeOptions]);

  useEffect(() => {
    const availableSceneSet = new Set(
      storyboardSceneOptions.map((scene) => scene.id)
    );
    setStoryboardSceneIds((currentSceneIds) =>
      currentSceneIds.filter((sceneId) => availableSceneSet.has(sceneId))
    );
  }, [storyboardSceneOptions]);

  async function refreshProjectBundle() {
    if (projectRefreshInFlightRef.current) {
      return;
    }

    projectRefreshInFlightRef.current = true;
    try {
      const response = await fetch(`/api/projects/${project.id}`, { cache: 'no-store' });
      const payload = await response.json();
      if (payload.ok) {
        setJobs(payload.jobs);
        setArtifacts(payload.artifacts);
        setArtifactRelations(payload.artifactRelations ?? []);
      }
    } finally {
      projectRefreshInFlightRef.current = false;
    }
  }

  async function handleSaveSource() {
    setSaving(true);
    setMessage(null);
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

  async function handleUploadSourceFile(file: File) {
    setUploadingSource(true);
    setMessage(null);
    try {
      const formData = new FormData();
      if (sourceTitle.trim()) {
        formData.append('title', sourceTitle.trim());
      }
      formData.append('file', file);

      const response = await fetch(`/api/projects/${project.id}/source`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (payload.ok) {
        setSourceTitle(payload.sourceDocument.title);
        setSourceText(payload.sourceDocument.textContent ?? '');
      }

      setMessage(payload.ok ? labels.saveSource : payload.error);
    } catch {
      setMessage('SOURCE_UPLOAD_FAILED');
    } finally {
      setUploadingSource(false);
    }
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
            genreLabel: getGenreDisplayLabel(locale, genre),
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

  async function handleRunStoryboardSelection() {
    if (storyboardSourceArtifactIds.length === 0) {
      setMessage(copy.storyboardSourceRequired);
      return;
    }

    setSelectedScriptArtifactId(storyboardSourceArtifactIds[0] ?? null);
    setRunningKind('storyboard');
    const response = await fetch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'storyboard-generation',
        payload: {
          ...buildStoryboardGenerationPayload({
            artifactIds: storyboardSourceArtifactIds,
            episodeNumbers: storyboardEpisodeNumbers,
            sceneIds: storyboardSceneIds,
          }),
          visualStyle: locale === 'en-US' ? 'cinematic realism' : '真人写实',
          colorTone: locale === 'en-US' ? 'warm tone' : '暖色调',
          genreLabel: getGenreDisplayLabel(locale, genre),
        },
      }),
    });
    const payload = await response.json();
    setRunningKind(null);
    setMessage(payload.ok ? copy.storyboardStarted : payload.error);
    if (payload.ok) {
      setActiveTab('jobs');
      startTransition(() => {
        void refreshProjectBundle();
      });
    }
  }

  function handlePrepareStoryboardFromArtifact(artifact: GenerationArtifact) {
    setSelectedScriptArtifactId(artifact.id);
    setStoryboardSourceArtifactIds([artifact.id]);
    setStoryboardEpisodeNumbers([]);
    setStoryboardSceneIds([]);
    setMessage(copy.storyboardScopePrepared);
  }

  function toggleStoryboardSourceArtifact(artifactId: string) {
    setStoryboardSourceArtifactIds((currentIds) => {
      if (currentIds.includes(artifactId)) {
        return currentIds.filter((currentId) => currentId !== artifactId);
      }

      return [...currentIds, artifactId];
    });
  }

  function toggleStoryboardEpisode(episodeNumber: number) {
    setStoryboardEpisodeNumbers((currentEpisodes) => {
      if (currentEpisodes.includes(episodeNumber)) {
        return currentEpisodes.filter((currentEpisode) => currentEpisode !== episodeNumber);
      }

      return [...currentEpisodes, episodeNumber].toSorted((left, right) => left - right);
    });
  }

  function toggleStoryboardScene(sceneId: string) {
    setStoryboardSceneIds((currentSceneIds) => {
      if (currentSceneIds.includes(sceneId)) {
        return currentSceneIds.filter((currentSceneId) => currentSceneId !== sceneId);
      }

      return [...currentSceneIds, sceneId];
    });
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
      <section className="workspace-hero project-detail-hero">
        <div className="project-detail-hero-copy">
          <a href={`/${locale}/projects`} className="inline-link">{labels.backToProjects}</a>
          <span className="eyebrow">{locale === 'en-US' ? 'Project studio' : '项目工作台'}</span>
          <h1>{project.name}</h1>
          <p>{project.description || labels.sourceHint}</p>
          <div className="project-hero-tags">
            <span className="chip chip-soft">{getGenreDisplayLabel(locale, project.genre ?? labels.genre)}</span>
            <span className="chip chip-count">{`${jobs.length} ${copy.jobsTab}`}</span>
            <span className="chip chip-count">{`${artifacts.length} ${copy.assetsTitle}`}</span>
          </div>
        </div>
        <div className="project-detail-hero-aside">
          <div className="metric-card metric-card-matcha">
            <span>{labels.scriptTab}</span>
            <strong>{scriptArtifacts.length}</strong>
            <small>{locale === 'en-US' ? 'Latest draft stack' : '当前剧本版本栈'}</small>
          </div>
          <div className="metric-card metric-card-slushie">
            <span>{copy.storyboardTab}</span>
            <strong>{storyboardArtifacts.length}</strong>
            <small>{locale === 'en-US' ? 'Visual output sets' : '可审阅分镜结果'}</small>
          </div>
          <div className="metric-card metric-card-lemon">
            <span>{copy.jobsTab}</span>
            <strong>{completedJobs.length}/{jobs.length}</strong>
            <small>{locale === 'en-US' ? 'Completed operations' : '已完成运行任务'}</small>
          </div>
        </div>
      </section>

      <section className="workspace-flow-shell">
        <div className="workflow-board">
          <div className="workflow-board-header">
            <div className="stack-gap-sm">
              <span className="eyebrow">{locale === 'en-US' ? 'Generation flow' : '生成流程'}</span>
              <h2>
                {locale === 'en-US'
                  ? 'Organize the workspace around Novel, Script, and Storyboard.'
                  : '把工作台重组为「小说 / 剧本 / 分镜」三段式流程。'}
              </h2>
              <p className="helper-text">
                {locale === 'en-US'
                  ? 'The top area now highlights the three major phases, while the lower area stays focused on preview and editing.'
                  : '顶部聚焦三大阶段，下面专门用于预览、编辑与审阅，阅读体验会更清晰。'}
              </p>
            </div>
            <div className="workflow-board-actions">
              <button
                type="button"
                className={`segment ${activeTab === 'exports' ? 'active' : ''}`}
                onClick={() => setActiveTab('exports')}
              >
                {copy.exportsTab}
              </button>
              <button
                type="button"
                className={`segment ${activeTab === 'jobs' ? 'active' : ''}`}
                onClick={() => setActiveTab('jobs')}
              >
                {copy.jobsTab}
              </button>
            </div>
          </div>

          <div className="workflow-stage-grid">
            {workflowStages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                className={`workflow-stage-card workflow-stage-card-${stage.tone} ${
                  activeWorkflowStage === stage.id ? 'active' : ''
                }`}
                onClick={() => setActiveTab(stage.primaryTab)}
              >
                <div className="workflow-stage-card-top">
                  <div className="workflow-stage-kicker">
                    <span className="workflow-stage-index">{stage.index}</span>
                    <span className={`status-pill status-pill-${stage.statusTone}`}>
                      {stage.statusLabel}
                    </span>
                  </div>
                  <span className="workflow-stage-meta">{stage.meta}</span>
                </div>
                <div className="workflow-stage-card-body">
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                </div>
                <div className="workflow-stage-progress">
                  <div className="workflow-stage-progress-track">
                    <span
                      className="workflow-stage-progress-fill"
                      style={{ width: `${stage.progress}%` }}
                    />
                  </div>
                  <div className="workflow-stage-stats">
                    {stage.stats.map((item) => (
                      <span key={item.label}>
                        <strong>{item.value}</strong>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="workflow-detail-bar">
            <div className="workflow-detail-copy">
              <span className="eyebrow">
                {locale === 'en-US' ? 'Current lane' : '当前阶段'}
              </span>
              <h3>{getWorkspaceSectionCopy(locale, activeTab, labels, copy).title}</h3>
              <p>{getWorkspaceSectionCopy(locale, activeTab, labels, copy).description}</p>
            </div>
            <div className="workflow-subnav">
              {workflowSubtabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`segment ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <PipelineProgressBar
          locale={locale}
          title={copy.pipelineTitle}
          subtitle={copy.pipelineSubtitle}
          stages={pipelineStages}
          jobs={jobs}
        />
        {failedPipelineStage ? (
          <article className="card workspace-note-card workspace-note-card-lemon stack-gap-sm">
            <span className="eyebrow">{locale === 'en-US' ? 'Action required' : '需要处理'}</span>
            <h3>
              {locale === 'en-US'
                ? `${failedPipelineStage.title} needs attention`
                : `${failedPipelineStage.title}需要处理`}
            </h3>
            <p>
              {failedPipelineStage.summary?.trim() ||
                (locale === 'en-US'
                  ? 'The latest generation job failed. Open Jobs to inspect the reason or retry.'
                  : '最新一次生成任务已经失败。打开任务页查看原因或重新发起。')}
            </p>
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActiveTab('jobs')}
              >
                {locale === 'en-US' ? 'Open jobs' : '打开任务'}
              </button>
            </div>
          </article>
        ) : null}
      </section>

      <section className="workspace-stage-band workspace-preview-band">
        <div className="workspace-stage-copy">
          <span className="eyebrow">
            {locale === 'en-US' ? 'Active lane' : '当前工作区'}
          </span>
          <h2>
            {getWorkspaceSectionCopy(locale, activeTab, labels, copy).title}
          </h2>
          <p>{getWorkspaceSectionCopy(locale, activeTab, labels, copy).description}</p>
        </div>
        <div className="workspace-stage-pills">
          {getWorkspaceStagePills(locale, activeTab, {
            sourceReady: sourceText.trim().length > 0,
            artifactCount: artifacts.length,
            scriptCount: scriptArtifacts.length,
            storyboardCount: storyboardArtifacts.length,
            exportCount: exportArtifacts.length,
            completedJobCount: completedJobs.length,
            totalJobCount: jobs.length,
          }).map((item) => (
            <div key={item.label} className="workspace-stage-pill">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="workspace-preview-shell">
      {activeTab === 'source' ? (
        <section className="workspace-grid workspace-detail-grid">
          <SourceEditorPanel
            locale={locale}
            labels={labels}
            sourceTitle={sourceTitle}
            sourceText={sourceText}
            genre={genre}
            episodeCount={episodeCount}
            episodeDuration={episodeDuration}
            style={style}
            message={message}
            saving={saving}
            uploading={uploadingSource}
            uploadAccept={SUPPORTED_TEXT_FILE_ACCEPT}
            runningKind={runningKind}
            pipelineActionLabel={copy.pipelineAction}
            onSourceTitleChange={setSourceTitle}
            onSourceTextChange={setSourceText}
            onGenreChange={setGenre}
            onEpisodeCountChange={setEpisodeCount}
            onEpisodeDurationChange={setEpisodeDuration}
            onStyleChange={setStyle}
            onSaveSource={handleSaveSource}
            onUploadFile={handleUploadSourceFile}
            onRunScript={handleRunScript}
            onRunPipeline={handleRunPipeline}
          />
          <div className="stack-gap workspace-detail-sidebar workspace-aside-stack">
            <article className="card workspace-note-card workspace-note-card-matcha">
              <span className="eyebrow">{locale === 'en-US' ? 'Next milestone' : '下一步'}</span>
              <h3>{locale === 'en-US' ? 'Shape the raw material before generation.' : '先把原始素材整理成可生成状态。'}</h3>
              <p>
                {locale === 'en-US'
                  ? 'Keep title, genre, episode count, and style aligned here so later versions stay coherent.'
                  : '先在这里统一标题、题材、集数与风格，后续生成出来的版本会更稳定。'}
              </p>
              <div className="workspace-mini-list">
                <div>
                  <strong>{labels.sourceTitle}</strong>
                  <span>{sourceTitle.trim() || project.name}</span>
                </div>
                <div>
                  <strong>{labels.genre}</strong>
                  <span>{getGenreDisplayLabel(locale, genre)}</span>
                </div>
                <div>
                  <strong>{labels.episodeCount}</strong>
                  <span>{episodeCount}</span>
                </div>
              </div>
            </article>
            {shouldShowWorkspaceOnboarding ? (
              <OnboardingChecklistPanel
                locale={locale}
                title={labels.onboardingTitle}
                subtitle={labels.onboardingSubtitle}
                steps={onboardingSteps}
                note={labels.onboardingNote}
                action={workspaceOnboardingAction}
              />
            ) : null}
            {sourceTabArtifacts.length > 0 ? (
              <AssetBrowserPanel
                locale={locale}
                title={copy.assetsTitle}
                subtitle={copy.assetsSubtitle}
                artifacts={sourceTabArtifacts}
                artifactRelations={artifactRelations}
                jobs={jobs}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'analysis' ? (
        <section className="workspace-section-shell">
          <article className="card workspace-note-card workspace-note-card-blueberry">
            <span className="eyebrow">{locale === 'en-US' ? 'Story logic' : '故事逻辑'}</span>
            <h3>{locale === 'en-US' ? 'Treat analysis as the operating brief.' : '把分析稿当成整条流水线的操作说明。'}</h3>
            <p>
              {locale === 'en-US'
                ? 'Refine conflicts, character motivations, and emotional beats here before outlining episodes.'
                : '先在这里校准冲突、角色动机和情绪节奏，再进入分集大纲会更顺。'}
            </p>
          </article>
          <ProjectArtifactStudioPanel
            locale={locale}
            title={labels.analysisTab}
            subtitle={labels.artifactStudioSubtitle}
            artifacts={artifacts}
            artifactRelations={artifactRelations}
            allowedKinds={['analysis']}
            initialKind="analysis"
            hideKindTabs
            labels={labels}
            onVersionSaved={refreshProjectBundle}
          />
        </section>
      ) : null}

      {activeTab === 'outline' ? (
        <section className="workspace-section-shell">
          <article className="card workspace-note-card workspace-note-card-slushie">
            <span className="eyebrow">{locale === 'en-US' ? 'Episode map' : '分集地图'}</span>
            <h3>{locale === 'en-US' ? 'Lock pacing before script drafting.' : '在写剧本前先锁定每集节奏。'}</h3>
            <p>
              {locale === 'en-US'
                ? 'Use the outline stage to make hooks, reversals, and key events legible for the full season arc.'
                : '用大纲阶段把钩子、反转和关键事件排清楚，整季节奏会更稳定。'}
            </p>
          </article>
          <ProjectArtifactStudioPanel
            locale={locale}
            title={labels.outlineTab}
            subtitle={labels.artifactStudioSubtitle}
            artifacts={artifacts}
            artifactRelations={artifactRelations}
            allowedKinds={['outline']}
            initialKind="outline"
            hideKindTabs
            labels={labels}
            onVersionSaved={refreshProjectBundle}
          />
        </section>
      ) : null}

      {activeTab === 'script' ? (
        <section className="workspace-grid workspace-detail-grid">
          <ProjectArtifactStudioPanel
            locale={locale}
            title={labels.scriptTab}
            subtitle={copy.scriptSubtitle}
            artifacts={artifacts}
            artifactRelations={artifactRelations}
            allowedKinds={['script']}
            initialKind="script"
            hideKindTabs
            scriptPrimaryActionLabel={copy.storyboardFromVersion}
            onRunScriptPrimaryAction={handlePrepareStoryboardFromArtifact}
            selectedArtifactId={selectedScriptArtifactId}
            labels={labels}
            onVersionSaved={refreshProjectBundle}
          />
          <div className="stack-gap workspace-detail-sidebar workspace-aside-stack">
            <article className="card workspace-note-card workspace-note-card-lemon">
              <span className="eyebrow">{locale === 'en-US' ? 'Storyboard handoff' : '分镜交接'}</span>
              <h3>{locale === 'en-US' ? 'Pick the script versions you want to visualize.' : '选择要进入分镜的剧本版本。'}</h3>
              <p>
                {locale === 'en-US'
                  ? 'Use one clean version for broad generation, or narrow by episode and scene when you want tighter control.'
                  : '整版生成时尽量只保留一个清晰版本；需要精控时，再按集数和场景缩小范围。'}
              </p>
              <div className="workspace-mini-list">
                <div>
                  <strong>{labels.scriptTab}</strong>
                  <span>{scriptArtifacts.length}</span>
                </div>
                <div>
                  <strong>{labels.storyboardSourceVersions}</strong>
                  <span>{storyboardSourceArtifactIds.length}</span>
                </div>
                <div>
                  <strong>{labels.storyboardEpisodeFilter}</strong>
                  <span>{storyboardEpisodeNumbers.length || (locale === 'en-US' ? 'All' : '全部')}</span>
                </div>
              </div>
            </article>
            <StoryboardGenerationPanel
              locale={locale}
              title={labels.storyboardScopeTitle}
              subtitle={labels.storyboardScopeHint}
              labels={{
                emptyState: labels.storyboardNoScripts,
                sourceVersions: labels.storyboardSourceVersions,
                useLatestVersions: labels.storyboardUseLatestVersions,
                episodeFilter: labels.storyboardEpisodeFilter,
                episodeFilterHint: labels.storyboardEpisodeFilterHint,
                sceneFilter: labels.storyboardSceneFilter,
                sceneFilterHint: labels.storyboardSceneFilterHint,
                noEpisodes: labels.storyboardNoEpisodes,
                noScenes: labels.storyboardNoScenes,
                clearFilters: labels.storyboardClearFilters,
                generate: labels.storyboardGenerateSelected,
                versionPrefix: labels.storyboardVersionPrefix,
                episodePrefix: labels.outlineEpisodeNumber,
              }}
              sourceOptions={storyboardScopeSourceOptions}
              selectedArtifactIds={storyboardSourceArtifactIds}
              selectedEpisodeNumbers={storyboardEpisodeNumbers}
              selectedSceneIds={storyboardSceneIds}
              episodeOptions={storyboardEpisodeOptions}
              sceneOptions={storyboardSceneOptions}
              message={runningKind === 'storyboard' ? copy.storyboardRunning : message}
              running={runningKind === 'storyboard'}
              onResetSources={() => setStoryboardSourceArtifactIds(defaultStoryboardSourceArtifactIds)}
              onToggleArtifact={toggleStoryboardSourceArtifact}
              onToggleEpisode={toggleStoryboardEpisode}
              onToggleScene={toggleStoryboardScene}
              onClearFilters={() => {
                setStoryboardEpisodeNumbers([]);
                setStoryboardSceneIds([]);
              }}
              onGenerate={handleRunStoryboardSelection}
            />
          </div>
        </section>
      ) : null}

      {activeTab === 'storyboard' ? (
        <section className="workspace-section-shell">
          <article className="card workspace-note-card workspace-note-card-matcha">
            <span className="eyebrow">{locale === 'en-US' ? 'Visual review' : '视觉审阅'}</span>
            <h3>{locale === 'en-US' ? 'Review framing, continuity, and downloadable outputs.' : '在这里检查镜头、连贯性与下载结果。'}</h3>
            <p>
              {locale === 'en-US'
                ? 'This is the best view for checking whether prompts, scenes, and final assets stay aligned.'
                : '这里最适合核对提示词、场景结构和最终资产是否保持一致。'}
            </p>
          </article>
          <StoryboardPanel
            locale={locale}
            title={copy.storyboardTab}
            subtitle={copy.storyboardSubtitle}
            artifacts={artifacts}
            artifactRelations={artifactRelations}
            jobs={jobs}
            onSelectSourceArtifact={handleSelectStoryboardSourceArtifact}
          />
        </section>
      ) : null}

      {activeTab === 'exports' ? (
        <section className="workspace-grid workspace-detail-grid">
          <ProjectExportPanel
            projectId={project.id}
            title={labels.exportsTitle}
            subtitle={labels.exportsSubtitle}
            markdownLabel={labels.exportMarkdown}
            jsonLabel={labels.exportJson}
            textLabel={labels.exportText}
            latestExportsLabel={labels.latestExports}
            downloadLabel={labels.downloadExport}
            exports={exportArtifacts}
            onExportCreated={refreshProjectBundle}
          />
          <div className="stack-gap workspace-detail-sidebar workspace-aside-stack">
            <article className="card workspace-note-card workspace-note-card-blueberry">
              <span className="eyebrow">{locale === 'en-US' ? 'Delivery lane' : '交付出口'}</span>
              <h3>{locale === 'en-US' ? 'Package the latest artifacts for handoff.' : '把最新资产整理成可交付版本。'}</h3>
              <p>
                {locale === 'en-US'
                  ? 'Exports are your clean outbound surface. Keep a quick browser beside them so downloading never breaks context.'
                  : '导出区是最终对外交付面，旁边保留资产浏览器能让下载和核对不脱节。'}
              </p>
              <div className="workspace-mini-list">
                <div>
                  <strong>{labels.latestExports}</strong>
                  <span>{exportArtifacts.length}</span>
                </div>
                <div>
                  <strong>{copy.assetsTitle}</strong>
                  <span>{artifacts.length}</span>
                </div>
              </div>
            </article>
            <AssetBrowserPanel
              locale={locale}
              title={copy.assetsTitle}
              subtitle={copy.assetsSubtitle}
              artifacts={artifacts}
              artifactRelations={artifactRelations}
              jobs={jobs}
            />
          </div>
        </section>
      ) : null}

      {activeTab === 'jobs' ? (
        <section className="workspace-section-shell">
          <article className="card workspace-note-card workspace-note-card-slushie">
            <span className="eyebrow">{locale === 'en-US' ? 'Operations' : '运行状态'}</span>
            <h3>{locale === 'en-US' ? 'Watch queue health and recover failures quickly.' : '随时看队列状态，失败了就尽快恢复。'}</h3>
            <p>
              {locale === 'en-US'
                ? 'This view becomes your control tower once generation starts. Retry, cancel, and confirm completion without leaving the workspace.'
                : '任务开始后，这里就是你的控制塔。重试、取消、确认完成都不需要离开工作台。'}
            </p>
            <div className="workspace-mini-list">
              <div>
                <strong>{copy.jobsTab}</strong>
                <span>{jobs.length}</span>
              </div>
              <div>
                <strong>{locale === 'en-US' ? 'Completed' : '已完成'}</strong>
                <span>{completedJobs.length}</span>
              </div>
              <div>
                <strong>{locale === 'en-US' ? 'Latest job' : '最近任务'}</strong>
                <span>{latestJob?.kind ?? (locale === 'en-US' ? 'None yet' : '暂无')}</span>
              </div>
            </div>
          </article>
          <JobTimelinePanel
            locale={locale}
            title={labels.latestJobs}
            subtitle={copy.jobsSubtitle}
            jobs={jobs}
            artifacts={artifacts}
            pipelineStages={pipelineStages}
            onRetryJob={(job) => handleJobAction(job, 'retry')}
            onCancelJob={(job) => handleJobAction(job, 'cancel')}
          />
        </section>
      ) : null}
      </div>
    </div>
  );
}

function getGenreDisplayLabel(locale: SupportedLocale, genre: string) {
  if (!GENRE_VALUES.includes(genre as (typeof GENRE_VALUES)[number])) {
    return genre;
  }

  const labels = locale === 'en-US' ? GENRE_LABELS_EN : GENRE_LABELS;
  return labels[genre as (typeof GENRE_VALUES)[number]];
}

function getWorkspaceSectionCopy(
  locale: SupportedLocale,
  activeTab: WorkspaceTab,
  labels: ProjectWorkspaceClientProps['labels'],
  copy: ReturnType<typeof getWorkspaceCopy>
) {
  if (locale === 'en-US') {
    switch (activeTab) {
      case 'source':
        return {
          title: 'Shape the source before you trigger the pipeline.',
          description: 'Capture the project brief, editorial settings, and generation intent in one readable surface.',
        };
      case 'analysis':
        return {
          title: `Refine ${labels.analysisTab.toLowerCase()} into a reliable planning brief.`,
          description: 'Keep the logic layer legible before the project expands into outline and script versions.',
        };
      case 'outline':
        return {
          title: 'Map episode structure before writing scene-level dialogue.',
          description: 'Use the outline lane to make pacing decisions visible for the whole story arc.',
        };
      case 'script':
        return {
          title: 'Edit script versions and prepare the storyboard handoff.',
          description: 'This is the main drafting lane, with generation controls staged beside version history.',
        };
      case 'storyboard':
        return {
          title: 'Review visual outputs and source links together.',
          description: 'Keep image results, prompt lineage, and downloadable assets in a single inspection space.',
        };
      case 'exports':
        return {
          title: 'Package the work for delivery without losing context.',
          description: 'Exports and the asset browser now sit side by side so final handoff stays fast.',
        };
      case 'jobs':
        return {
          title: 'Monitor the queue like an operations console.',
          description: 'Retries, cancellations, and progress checks should feel separated from editing work.',
        };
    }
  }

  switch (activeTab) {
    case 'source':
      return {
        title: '先把原文和项目设定整理清楚，再触发整条生成流程。',
        description: '把项目简介、编辑参数和生成意图放到同一块清晰的工作面里。',
      };
    case 'analysis':
      return {
        title: `先把${labels.analysisTab}整理成可靠的策划底稿。`,
        description: '先把逻辑层梳理清楚，再继续展开成大纲和剧本版本。',
      };
    case 'outline':
      return {
        title: '先搭好分集结构，再进入具体对白和场景。',
        description: '用大纲视图把整季节奏、钩子和关键事件看得更清楚。',
      };
    case 'script':
      return {
        title: '在这里编辑剧本版本，并把它们顺畅交给分镜流程。',
        description: '这是主创作区，版本编辑和分镜触发器被安排成更清晰的主次关系。',
      };
    case 'storyboard':
      return {
        title: '把视觉结果、来源链路和下载资产放在一起审看。',
        description: '核对图像质量时，不需要再来回切换不同视图。',
      };
    case 'exports':
      return {
        title: '在不脱离上下文的前提下完成交付打包。',
        description: '导出结果和资产浏览器并排呈现，交付过程会更顺。',
      };
    case 'jobs':
      return {
        title: '把任务队列当成控制台来看，而不是编辑器附属页。',
        description: '重试、取消和追踪进度都应该和创作面板明确分层。',
      };
  }
}

function getWorkflowStageFromTab(activeTab: WorkspaceTab): WorkflowStageId {
  switch (activeTab) {
    case 'analysis':
    case 'outline':
    case 'script':
      return 'script';
    case 'storyboard':
      return 'storyboard';
    default:
      return 'novel';
  }
}

function getWorkflowSubtabs(
  locale: SupportedLocale,
  labels: ProjectWorkspaceClientProps['labels'],
  stage: WorkflowStageId
) {
  switch (stage) {
    case 'script':
      return [
        { id: 'analysis' as const, label: labels.analysisTab },
        { id: 'outline' as const, label: labels.outlineTab },
        { id: 'script' as const, label: labels.scriptTab },
      ];
    case 'storyboard':
      return [
        {
          id: 'storyboard' as const,
          label: locale === 'en-US' ? 'Storyboard Preview' : '分镜预览',
        },
      ];
    default:
      return [
        {
          id: 'source' as const,
          label: locale === 'en-US' ? 'Novel Source' : '小说原文',
        },
      ];
  }
}

function buildWorkflowStages(
  locale: SupportedLocale,
  input: {
    pipelineStages: ReturnType<typeof deriveProjectPipelineStages>;
    sourceText: string;
    scriptArtifacts: GenerationArtifact[];
    storyboardArtifacts: GenerationArtifact[];
    jobs: GenerationJob[];
  }
) {
  const sourceStage = input.pipelineStages.find((stage) => stage.id === 'source');
  const analysisStage = input.pipelineStages.find((stage) => stage.id === 'analysis');
  const outlineStage = input.pipelineStages.find((stage) => stage.id === 'outline');
  const scriptStage = input.pipelineStages.find((stage) => stage.id === 'script');
  const storyboardStage = input.pipelineStages.find((stage) => stage.id === 'storyboard');
  const scriptStatuses = [analysisStage?.status, outlineStage?.status, scriptStage?.status].filter(
    (status): status is PipelineStageStatus => Boolean(status)
  );
  const completedScriptSteps = scriptStatuses.filter((status) => status === 'succeeded').length;

  return [
    {
      id: 'novel' as const,
      index: locale === 'en-US' ? '01' : '一',
      title: locale === 'en-US' ? 'Novel' : '小说',
      description:
        locale === 'en-US'
          ? 'Upload the original text, set genre and pacing, and prepare the source material for generation.'
          : '上传原文、设置题材与节奏，把小说素材整理成后续生成的稳定起点。',
      primaryTab: 'source' as const,
      progress: sourceStage?.status === 'succeeded' ? 100 : input.sourceText.trim() ? 72 : 16,
      tone: 'novel' as const,
      statusTone: getStatusTone(sourceStage?.status ?? 'pending'),
      statusLabel: getStatusLabel(locale, sourceStage?.status ?? 'pending'),
      meta:
        locale === 'en-US'
          ? `${input.sourceText.trim().length.toLocaleString()} chars`
          : `${input.sourceText.trim().length.toLocaleString()} 字`,
      stats: [
        { label: locale === 'en-US' ? 'source' : '原文', value: input.sourceText.trim() ? '1' : '0' },
        { label: locale === 'en-US' ? 'jobs' : '任务', value: String(input.jobs.length) },
      ],
    },
    {
      id: 'script' as const,
      index: locale === 'en-US' ? '02' : '二',
      title: locale === 'en-US' ? 'Script' : '剧本',
      description:
        locale === 'en-US'
          ? 'Bundle analysis, outline, and drafting into one readable middle lane.'
          : '把分析、大纲和剧本收拢到同一个中段工作区里，阅读和修改都会更顺。',
      primaryTab: 'script' as const,
      progress: Math.round((completedScriptSteps / Math.max(scriptStatuses.length, 1)) * 100),
      tone: 'script' as const,
      statusTone: getAggregateStatusTone(scriptStatuses),
      statusLabel: getAggregateStatusLabel(locale, scriptStatuses),
      meta:
        locale === 'en-US'
          ? `${input.scriptArtifacts.length} script versions`
          : `${input.scriptArtifacts.length} 个剧本版本`,
      stats: [
        { label: locale === 'en-US' ? 'analysis' : '分析', value: analysisStage?.status === 'succeeded' ? '1' : '0' },
        { label: locale === 'en-US' ? 'outline' : '大纲', value: outlineStage?.status === 'succeeded' ? '1' : '0' },
        { label: locale === 'en-US' ? 'scripts' : '剧本', value: String(input.scriptArtifacts.length) },
      ],
    },
    {
      id: 'storyboard' as const,
      index: locale === 'en-US' ? '03' : '三',
      title: locale === 'en-US' ? 'Storyboard' : '分镜',
      description:
        locale === 'en-US'
          ? 'Inspect visual outputs, prompts, and linked assets in a cinematic preview lane.'
          : '把视觉结果、提示词和相关资产放进更像成片预览的审阅区里。',
      primaryTab: 'storyboard' as const,
      progress:
        storyboardStage?.status === 'succeeded'
          ? 100
          : input.storyboardArtifacts.length > 0
            ? 84
            : 12,
      tone: 'storyboard' as const,
      statusTone: getStatusTone(storyboardStage?.status ?? 'pending'),
      statusLabel: getStatusLabel(locale, storyboardStage?.status ?? 'pending'),
      meta:
        locale === 'en-US'
          ? `${input.storyboardArtifacts.length} storyboard sets`
          : `${input.storyboardArtifacts.length} 组分镜`,
      stats: [
        { label: locale === 'en-US' ? 'boards' : '分镜', value: String(input.storyboardArtifacts.length) },
        {
          label: locale === 'en-US' ? 'status' : '状态',
          value:
            storyboardStage?.status === 'succeeded'
              ? locale === 'en-US'
                ? 'done'
                : '完成'
              : locale === 'en-US'
                ? 'pending'
                : '待开始',
        },
      ],
    },
  ];
}

function getStatusTone(status: string) {
  if (status === 'failed') {
    return 'danger';
  }
  if (status === 'running' || status === 'queued') {
    return 'running';
  }
  if (status === 'succeeded') {
    return 'success';
  }
  return 'muted';
}

function getStatusLabel(locale: SupportedLocale, status: string) {
  switch (status) {
    case 'succeeded':
      return locale === 'en-US' ? 'Ready' : '已就绪';
    case 'running':
      return locale === 'en-US' ? 'Running' : '进行中';
    case 'queued':
      return locale === 'en-US' ? 'Queued' : '排队中';
    case 'failed':
      return locale === 'en-US' ? 'Failed' : '失败';
    default:
      return locale === 'en-US' ? 'Pending' : '待开始';
  }
}

function getAggregateStatusTone(statuses: string[]) {
  if (statuses.some((status) => status === 'failed')) {
    return 'danger';
  }
  if (statuses.some((status) => status === 'running' || status === 'queued')) {
    return 'running';
  }
  if (statuses.length > 0 && statuses.every((status) => status === 'succeeded')) {
    return 'success';
  }
  return 'muted';
}

function getAggregateStatusLabel(locale: SupportedLocale, statuses: string[]) {
  if (statuses.some((status) => status === 'failed')) {
    return locale === 'en-US' ? 'Needs review' : '需要检查';
  }
  if (statuses.some((status) => status === 'running' || status === 'queued')) {
    return locale === 'en-US' ? 'Generating' : '生成中';
  }
  if (statuses.length > 0 && statuses.every((status) => status === 'succeeded')) {
    return locale === 'en-US' ? 'Ready' : '已完成';
  }
  return locale === 'en-US' ? 'Drafting' : '整理中';
}

function getWorkspaceStagePills(
  locale: SupportedLocale,
  activeTab: WorkspaceTab,
  stats: {
    sourceReady: boolean;
    artifactCount: number;
    scriptCount: number;
    storyboardCount: number;
    exportCount: number;
    completedJobCount: number;
    totalJobCount: number;
  }
) {
  const yes = locale === 'en-US' ? 'Ready' : '就绪';
  const no = locale === 'en-US' ? 'Draft' : '草稿';

  switch (activeTab) {
    case 'source':
      return [
        { label: locale === 'en-US' ? 'Source' : '原文', value: stats.sourceReady ? yes : no },
        { label: locale === 'en-US' ? 'Scripts' : '剧本', value: String(stats.scriptCount) },
        { label: locale === 'en-US' ? 'Jobs' : '任务', value: `${stats.completedJobCount}/${stats.totalJobCount}` },
      ];
    case 'analysis':
    case 'outline':
      return [
        { label: locale === 'en-US' ? 'Artifacts' : '资产', value: String(stats.artifactCount) },
        { label: locale === 'en-US' ? 'Scripts' : '剧本', value: String(stats.scriptCount) },
        { label: locale === 'en-US' ? 'Storyboards' : '分镜', value: String(stats.storyboardCount) },
      ];
    case 'script':
      return [
        { label: locale === 'en-US' ? 'Versions' : '版本', value: String(stats.scriptCount) },
        { label: locale === 'en-US' ? 'Storyboards' : '分镜', value: String(stats.storyboardCount) },
        { label: locale === 'en-US' ? 'Queue' : '队列', value: `${stats.completedJobCount}/${stats.totalJobCount}` },
      ];
    case 'storyboard':
      return [
        { label: locale === 'en-US' ? 'Boards' : '分镜', value: String(stats.storyboardCount) },
        { label: locale === 'en-US' ? 'Exports' : '导出', value: String(stats.exportCount) },
        { label: locale === 'en-US' ? 'Assets' : '资产', value: String(stats.artifactCount) },
      ];
    case 'exports':
      return [
        { label: locale === 'en-US' ? 'Exports' : '导出', value: String(stats.exportCount) },
        { label: locale === 'en-US' ? 'Assets' : '资产', value: String(stats.artifactCount) },
        { label: locale === 'en-US' ? 'Completed' : '完成', value: String(stats.completedJobCount) },
      ];
    case 'jobs':
      return [
        { label: locale === 'en-US' ? 'Completed' : '完成', value: String(stats.completedJobCount) },
        { label: locale === 'en-US' ? 'Total' : '总数', value: String(stats.totalJobCount) },
        { label: locale === 'en-US' ? 'Boards' : '分镜', value: String(stats.storyboardCount) },
      ];
  }
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
      storyboardRunning: 'Creating storyboard job...',
      storyboardSourceRequired: 'Select at least one script version first.',
      storyboardScopePrepared: 'Added the current script version to storyboard scope.',
      storyboardFromVersion: 'Use this version in storyboard scope',
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
    storyboardRunning: '正在创建分镜任务...',
    storyboardSourceRequired: '请先选择至少一个剧本版本',
    storyboardScopePrepared: '已将当前剧本版本带入分镜范围',
    storyboardFromVersion: '将此版本带入分镜范围',
    storyboardSubtitle: '浏览分镜版本、下载结果和来源关系。',
    scriptSubtitle: '编辑剧本版本，并从指定版本继续生成分镜。',
    assetsTitle: '资产浏览器',
    assetsSubtitle: '统一筛选、预览和下载项目内全部资产。',
    jobsSubtitle: '查看排队、运行、失败和完成的生成任务。',
  };
}

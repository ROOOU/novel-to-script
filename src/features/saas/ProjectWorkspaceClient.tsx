'use client';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WorkspaceCapabilityCard,
  WorkspaceHero,
  WorkspaceMetricCard,
  WorkspaceMiniList,
  WorkspaceNoteCard,
  WorkspaceStatusPill,
  type WorkspaceStatusTone,
} from '@/components/WorkspaceUI';
import { SUPPORTED_TEXT_FILE_ACCEPT } from '@/lib/file-text';
import { parseStoryboardShotsFromContent } from '@/lib/storyboard-shots';
import { GENRE_LABELS, GENRE_LABELS_EN, GENRE_VALUES } from '@/lib/types';
import type { VideoAspectRatio } from '@/features/video-generation/contracts';
import type {
  ArtifactRelation,
  GenerationArtifact,
  GenerationJob,
  PromptPackTargetPlatform,
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
import { VideoGenerationPanel } from '@/features/saas/project/VideoGenerationPanel';
import { deriveProjectSourceDraftConfig } from '@/features/saas/project/source-config';
import {
  buildStoryboardGenerationPayload,
  deriveDefaultStoryboardSourceArtifactIds,
  deriveStoryboardScopeEpisodeOptions,
  deriveStoryboardScopeSceneOptions,
  deriveStoryboardScopeSourceOptions,
} from '@/features/saas/project/storyboard-scope';
import { buildProjectWorkspaceOnboardingSteps } from '@/features/saas/project/onboarding';

type WorkspaceTab =
  | 'source'
  | 'analysis'
  | 'outline'
  | 'script'
  | 'storyboard'
  | 'video'
  | 'exports'
  | 'jobs';
type WorkflowStageId = 'novel' | 'script' | 'storyboard';

const DEFAULT_STORYBOARD_TARGET_PLATFORM: PromptPackTargetPlatform = 'seedance';

interface ProjectWorkspaceClientProps {
  locale: SupportedLocale;
  project: Project;
  videoEnabled: boolean;
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
  videoEnabled,
  initialSourceTitle,
  initialSourceText,
  jobs: initialJobs,
  artifacts: initialArtifacts,
  artifactRelations: initialArtifactRelations,
  labels,
}: ProjectWorkspaceClientProps) {
  const projectRefreshInFlightRef = useRef(false);
  const copy = getWorkspaceCopy(locale);
  const initialSourceDraftConfig = useMemo(
    () =>
      deriveProjectSourceDraftConfig({
        projectGenre: project.genre,
        jobs: initialJobs,
      }),
    [initialJobs, project.genre]
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('source');
  const [sourceTitle, setSourceTitle] = useState(initialSourceTitle);
  const [sourceText, setSourceText] = useState(initialSourceText);
  const [jobs, setJobs] = useState(initialJobs);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [artifactRelations, setArtifactRelations] = useState(initialArtifactRelations);
  const [selectedScriptArtifactId, setSelectedScriptArtifactId] = useState<string | null>(null);
  const [genre, setGenre] = useState(initialSourceDraftConfig.genre);
  const [episodeCount, setEpisodeCount] = useState(initialSourceDraftConfig.episodeCount);
  const [episodeDuration, setEpisodeDuration] = useState(initialSourceDraftConfig.episodeDuration);
  const [style, setStyle] = useState(initialSourceDraftConfig.style);
  const [saving, setSaving] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [uploadingVideoAsset, setUploadingVideoAsset] = useState(false);
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
  const scriptArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind === 'script'),
    [artifacts]
  );
  const storyboardArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind === 'storyboard'),
    [artifacts]
  );
  const shotPlanArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind === 'shot_plan'),
    [artifacts]
  );
  const promptPackArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind === 'prompt_pack'),
    [artifacts]
  );
  const referenceImageArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind === 'reference_image'),
    [artifacts]
  );
  const videoArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind === 'video_clip'),
    [artifacts]
  );
  const exportArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind === 'export'),
    [artifacts]
  );
  const completedJobs = useMemo(
    () => jobs.filter((job) => job.status === 'succeeded'),
    [jobs]
  );
  const latestJob = jobs[0] ?? null;
  const [selectedVideoShotPlanArtifactId, setSelectedVideoShotPlanArtifactId] = useState<string | null>(null);
  const [selectedVideoShotId, setSelectedVideoShotId] = useState<string | null>(null);
  const [videoPromptOverride, setVideoPromptOverride] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>('9:16');
  const [selectedVideoReferenceImageArtifactIds, setSelectedVideoReferenceImageArtifactIds] = useState<string[]>([]);
  const [selectedVideoFirstFrameArtifactId, setSelectedVideoFirstFrameArtifactId] = useState<string | null>(null);
  const [selectedVideoLastFrameArtifactId, setSelectedVideoLastFrameArtifactId] = useState<string | null>(null);
  const selectedVideoShotPlanArtifact = useMemo(
    () =>
      shotPlanArtifacts.find((artifact) => artifact.id === selectedVideoShotPlanArtifactId) ??
      shotPlanArtifacts[0] ??
      null,
    [selectedVideoShotPlanArtifactId, shotPlanArtifacts]
  );
  const selectedVideoShots = useMemo(
    () => parseStoryboardShotsFromContent(selectedVideoShotPlanArtifact?.content),
    [selectedVideoShotPlanArtifact?.content]
  );
  const sourceCharacterCount = sourceText.trim().length;
  const activeWorkflowStage = getWorkflowStageFromTab(activeTab);
  const activeSectionCopy = useMemo(
    () => getWorkspaceSectionCopy(locale, activeTab, labels),
    [activeTab, labels, locale]
  );
  const workflowStages = useMemo(
    () =>
      buildWorkflowStages(locale, {
        pipelineStages,
        sourceText,
        scriptArtifacts,
        storyboardArtifacts,
        shotPlanArtifacts,
        promptPackArtifacts,
        videoArtifacts,
        jobs,
      }),
    [
      jobs,
      locale,
      pipelineStages,
      promptPackArtifacts,
      scriptArtifacts,
      shotPlanArtifacts,
      sourceText,
      storyboardArtifacts,
      videoArtifacts,
    ]
  );
  const capabilityCards = useMemo(
    () =>
      buildWorkspaceCapabilityCards(locale, {
        sourceCharacterCount,
        scriptArtifacts,
        storyboardArtifacts,
        shotPlanArtifacts,
        promptPackArtifacts,
        videoArtifacts,
        exportArtifacts,
        jobs,
        videoEnabled,
      }),
    [
      exportArtifacts,
      jobs,
      locale,
      promptPackArtifacts,
      scriptArtifacts,
      shotPlanArtifacts,
      sourceCharacterCount,
      storyboardArtifacts,
      videoArtifacts,
      videoEnabled,
    ]
  );
  const workflowSubtabs = getWorkflowSubtabs(locale, labels, activeWorkflowStage, videoEnabled);
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

  const refreshProjectBundle = useCallback(async () => {
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
  }, [project.id]);

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
  }, [hasActiveJobs, refreshProjectBundle]);

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

  useEffect(() => {
    setSelectedVideoShotPlanArtifactId((currentId) => {
      if (currentId && shotPlanArtifacts.some((artifact) => artifact.id === currentId)) {
        return currentId;
      }

      return shotPlanArtifacts[0]?.id ?? null;
    });
  }, [shotPlanArtifacts]);

  useEffect(() => {
    const availableShotIdSet = new Set(selectedVideoShots.map((shot) => shot.shotId));
    setSelectedVideoShotId((currentId) => {
      if (currentId && availableShotIdSet.has(currentId)) {
        return currentId;
      }

      return selectedVideoShots[0]?.shotId ?? null;
    });
  }, [selectedVideoShots]);

  useEffect(() => {
    const availableImageIdSet = new Set(referenceImageArtifacts.map((artifact) => artifact.id));
    setSelectedVideoReferenceImageArtifactIds((currentIds) =>
      currentIds.filter((artifactId) => availableImageIdSet.has(artifactId))
    );
    setSelectedVideoFirstFrameArtifactId((currentId) =>
      currentId && availableImageIdSet.has(currentId) ? currentId : null
    );
    setSelectedVideoLastFrameArtifactId((currentId) =>
      currentId && availableImageIdSet.has(currentId) ? currentId : null
    );
  }, [referenceImageArtifacts]);

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
            targetPlatform: DEFAULT_STORYBOARD_TARGET_PLATFORM,
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
          targetPlatform: DEFAULT_STORYBOARD_TARGET_PLATFORM,
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

  async function handleUploadVideoAsset(file: File) {
    setUploadingVideoAsset(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/projects/${project.id}/assets`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      setMessage(payload.ok ? copy.videoAssetUploaded : payload.error);

      if (payload.ok) {
        await refreshProjectBundle();
      }
    } catch {
      setMessage('ASSET_UPLOAD_FAILED');
    } finally {
      setUploadingVideoAsset(false);
    }
  }

  async function handleRunVideoGeneration() {
    if (!selectedVideoShotPlanArtifact || !selectedVideoShotId) {
      setMessage(copy.videoShotRequired);
      return;
    }

    if (!!selectedVideoFirstFrameArtifactId !== !!selectedVideoLastFrameArtifactId) {
      setMessage(copy.videoFramePairRequired);
      return;
    }

    setRunningKind('video');
    setMessage(null);
    const response = await fetch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'video-generation',
        payload: {
          shotPlanArtifactId: selectedVideoShotPlanArtifact.id,
          shotId: selectedVideoShotId,
          ...(videoPromptOverride.trim() ? { promptOverride: videoPromptOverride.trim() } : {}),
          ...(selectedVideoReferenceImageArtifactIds.length > 0
            ? { referenceImageArtifactIds: selectedVideoReferenceImageArtifactIds }
            : {}),
          ...(selectedVideoFirstFrameArtifactId ? { firstFrameArtifactId: selectedVideoFirstFrameArtifactId } : {}),
          ...(selectedVideoLastFrameArtifactId ? { lastFrameArtifactId: selectedVideoLastFrameArtifactId } : {}),
          aspectRatio: videoAspectRatio,
        },
      }),
    });
    const payload = await response.json();
    setRunningKind(null);
    setMessage(payload.ok ? copy.videoStarted : payload.error);
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

  function toggleVideoReferenceImage(artifactId: string) {
    setSelectedVideoReferenceImageArtifactIds((currentIds) => {
      if (currentIds.includes(artifactId)) {
        return currentIds.filter((currentId) => currentId !== artifactId);
      }

      if (currentIds.length >= 3) {
        return currentIds;
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
      <WorkspaceHero
        variant="detail"
        as="section"
        beforeHeader={
          <a href={`/${locale}/projects`} className="inline-link">
            {labels.backToProjects}
          </a>
        }
        eyebrow={locale === 'en-US' ? 'Project studio' : '项目工作台'}
        title={project.name}
        description={project.description || labels.sourceHint}
        tags={[
          <span key="genre" className="chip chip-soft">
            {getGenreDisplayLabel(locale, project.genre ?? labels.genre)}
          </span>,
          <span key="jobs" className="chip chip-count">{`${jobs.length} ${copy.jobsTab}`}</span>,
          <span key="artifacts" className="chip chip-count">{`${artifacts.length} ${copy.assetsTitle}`}</span>,
        ]}
        aside={
          <>
            <WorkspaceMetricCard
              tone="matcha"
              label={locale === 'en-US' ? 'Source' : '原文'}
              value={sourceCharacterCount.toLocaleString()}
              detail={locale === 'en-US' ? 'Characters in the working draft' : '当前工作底稿字数'}
            />
            <WorkspaceMetricCard
              tone="slushie"
              label={labels.scriptTab}
              value={scriptArtifacts.length}
              detail={locale === 'en-US' ? 'Latest draft stack' : '当前剧本版本栈'}
            />
            <WorkspaceMetricCard
              tone="lemon"
              label={copy.storyboardTab}
              value={storyboardArtifacts.length}
              detail={
                locale === 'en-US'
                  ? `${shotPlanArtifacts.length} linked shot plans`
                  : `${shotPlanArtifacts.length} 份关联镜头计划`
              }
            />
            <WorkspaceMetricCard
              tone="ube"
              label={locale === 'en-US' ? 'Prompt Packs' : '提示词包'}
              value={promptPackArtifacts.length}
              detail={
                locale === 'en-US'
                  ? 'Seedance and downstream prompt outputs'
                  : 'Seedance 与下游生成提示词输出'
              }
            />
          </>
        }
      />

      <section className="workspace-capability-grid">
        {capabilityCards.map((card) => (
          <WorkspaceCapabilityCard
            key={card.id}
            tone={card.tone}
            eyebrow={card.eyebrow}
            title={card.title}
            badge={card.value}
            description={card.description}
            titlePlacement="body"
            metaOrder="value-first"
            active={activeTab === card.tab}
            meta={card.meta.map((item) => ({
              key: `${card.id}-${item.label}`,
              label: item.label,
              value: item.value,
            }))}
            action={
              <button
                type="button"
                className={`secondary-button workspace-capability-action ${
                  activeTab === card.tab ? 'active' : ''
                }`}
                onClick={() => setActiveTab(card.tab)}
              >
                {card.actionLabel}
              </button>
            }
          />
        ))}
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
                    <WorkspaceStatusPill tone={stage.statusTone}>
                      {stage.statusLabel}
                    </WorkspaceStatusPill>
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
              <h3>{activeSectionCopy.title}</h3>
              <p>{activeSectionCopy.description}</p>
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
          <WorkspaceNoteCard
            tone="lemon"
            eyebrow={locale === 'en-US' ? 'Action required' : '需要处理'}
            title={
              locale === 'en-US'
                ? `${failedPipelineStage.title} needs attention`
                : `${failedPipelineStage.title}需要处理`
            }
            description={
              failedPipelineStage.summary?.trim() ||
              (locale === 'en-US'
                ? 'The latest generation job failed. Open Jobs to inspect the reason or retry.'
                : '最新一次生成任务已经失败。打开任务页查看原因或重新发起。')
            }
            titleAs="h3"
            className="stack-gap-sm"
          >
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActiveTab('jobs')}
              >
                {locale === 'en-US' ? 'Open jobs' : '打开任务'}
              </button>
            </div>
          </WorkspaceNoteCard>
        ) : null}
      </section>

      <section className="workspace-stage-band workspace-preview-band">
        <div className="workspace-stage-copy">
          <span className="eyebrow">
            {locale === 'en-US' ? 'Active lane' : '当前工作区'}
          </span>
          <h2>{activeSectionCopy.title}</h2>
          <p>{activeSectionCopy.description}</p>
        </div>
        <div className="workspace-stage-pills">
          {getWorkspaceStagePills(locale, activeTab, {
            sourceReady: sourceText.trim().length > 0,
            artifactCount: artifacts.length,
            scriptCount: scriptArtifacts.length,
            storyboardCount: storyboardArtifacts.length,
            shotPlanCount: shotPlanArtifacts.length,
            promptPackCount: promptPackArtifacts.length,
            videoCount: videoArtifacts.length,
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
            <WorkspaceNoteCard
              tone="matcha"
              eyebrow={locale === 'en-US' ? 'Next milestone' : '下一步'}
              title={locale === 'en-US' ? 'Shape the raw material before generation.' : '先把原始素材整理成可生成状态。'}
              description={
                locale === 'en-US'
                  ? 'Keep title, genre, episode count, and style aligned here so later versions stay coherent.'
                  : '先在这里统一标题、题材、集数与风格，后续生成出来的版本会更稳定。'
              }
              titleAs="h3"
            >
              <WorkspaceMiniList
                items={[
                  {
                    key: 'source',
                    label: labels.sourceTitle,
                    value: sourceTitle.trim() || project.name,
                  },
                  {
                    key: 'genre',
                    label: labels.genre,
                    value: getGenreDisplayLabel(locale, genre),
                  },
                  {
                    key: 'episodes',
                    label: labels.episodeCount,
                    value: episodeCount,
                  },
                ]}
              />
            </WorkspaceNoteCard>
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
          <WorkspaceNoteCard
            tone="blueberry"
            eyebrow={locale === 'en-US' ? 'Story logic' : '故事逻辑'}
            title={locale === 'en-US' ? 'Treat analysis as the operating brief.' : '把分析稿当成整条流水线的操作说明。'}
            description={
              locale === 'en-US'
                ? 'Refine conflicts, character motivations, and emotional beats here before outlining episodes.'
                : '先在这里校准冲突、角色动机和情绪节奏，再进入分集大纲会更顺。'
            }
            titleAs="h3"
          />
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
          <WorkspaceNoteCard
            tone="slushie"
            eyebrow={locale === 'en-US' ? 'Episode map' : '分集地图'}
            title={locale === 'en-US' ? 'Lock pacing before script drafting.' : '在写剧本前先锁定每集节奏。'}
            description={
              locale === 'en-US'
                ? 'Use the outline stage to make hooks, reversals, and key events legible for the full season arc.'
                : '用大纲阶段把钩子、反转和关键事件排清楚，整季节奏会更稳定。'
            }
            titleAs="h3"
          />
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
            <WorkspaceNoteCard
              tone="lemon"
              eyebrow={locale === 'en-US' ? 'Storyboard handoff' : '分镜交接'}
              title={locale === 'en-US' ? 'Pick the script versions you want to visualize.' : '选择要进入分镜的剧本版本。'}
              description={
                locale === 'en-US'
                  ? 'Use one clean version for broad generation, or narrow by episode and scene when you want tighter control.'
                  : '整版生成时尽量只保留一个清晰版本；需要精控时，再按集数和场景缩小范围。'
              }
              titleAs="h3"
            >
              <WorkspaceMiniList
                items={[
                  {
                    key: 'scripts',
                    label: labels.scriptTab,
                    value: scriptArtifacts.length,
                  },
                  {
                    key: 'sources',
                    label: labels.storyboardSourceVersions,
                    value: storyboardSourceArtifactIds.length,
                  },
                  {
                    key: 'episodes',
                    label: labels.storyboardEpisodeFilter,
                    value: storyboardEpisodeNumbers.length || (locale === 'en-US' ? 'All' : '全部'),
                  },
                ]}
              />
            </WorkspaceNoteCard>
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
            <WorkspaceNoteCard
              tone="matcha"
              eyebrow={locale === 'en-US' ? 'Visual review' : '视觉审阅'}
              title={
                locale === 'en-US'
                  ? 'Review framing, continuity, shot plans, and downloadable prompt packs.'
                  : '在这里检查镜头、连贯性、镜头计划与可下载提示词包。'
              }
              description={
                locale === 'en-US'
                  ? 'This is the best view for checking whether prompts, scenes, shot plans, and final assets stay aligned.'
                  : '这里最适合核对提示词、场景结构、镜头计划和最终资产是否保持一致。'
              }
              titleAs="h3"
            />
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

      {activeTab === 'video' ? (
        <section className="workspace-grid workspace-detail-grid">
          <VideoGenerationPanel
            locale={locale}
            enabled={videoEnabled}
            message={
              runningKind === 'video'
                ? copy.videoRunning
                : uploadingVideoAsset
                  ? copy.videoAssetUploading
                  : message
            }
            generating={runningKind === 'video'}
            uploading={uploadingVideoAsset}
            shotPlanArtifacts={shotPlanArtifacts}
            referenceImageArtifacts={referenceImageArtifacts}
            selectedShotPlanArtifactId={selectedVideoShotPlanArtifact?.id ?? null}
            selectedShotId={selectedVideoShotId}
            promptOverride={videoPromptOverride}
            aspectRatio={videoAspectRatio}
            selectedReferenceImageArtifactIds={selectedVideoReferenceImageArtifactIds}
            selectedFirstFrameArtifactId={selectedVideoFirstFrameArtifactId}
            selectedLastFrameArtifactId={selectedVideoLastFrameArtifactId}
            onShotPlanArtifactChange={setSelectedVideoShotPlanArtifactId}
            onShotIdChange={setSelectedVideoShotId}
            onPromptOverrideChange={setVideoPromptOverride}
            onAspectRatioChange={setVideoAspectRatio}
            onToggleReferenceImage={toggleVideoReferenceImage}
            onFirstFrameArtifactChange={setSelectedVideoFirstFrameArtifactId}
            onLastFrameArtifactChange={setSelectedVideoLastFrameArtifactId}
            onUploadAsset={handleUploadVideoAsset}
            onGenerate={handleRunVideoGeneration}
          />
          <div className="stack-gap workspace-detail-sidebar workspace-aside-stack">
            <WorkspaceNoteCard
              tone="lemon"
              eyebrow={locale === 'en-US' ? 'Media lane' : '媒体工作区'}
              title={locale === 'en-US' ? 'Keep references and generated clips beside the form.' : '把参考图和生成结果放在表单旁边一起看。'}
              description={
                locale === 'en-US'
                  ? 'The first version focuses on image-guided Veo generation, so reference images and video clips stay in the same review rail.'
                  : '第一期先聚焦图片引导的 Veo 生成，因此参考图和视频片段会放在同一条审阅侧栏里。'
              }
              titleAs="h3"
            >
              <WorkspaceMiniList
                items={[
                  {
                    key: 'shotPlans',
                    label: locale === 'en-US' ? 'Shot plans' : '镜头计划',
                    value: shotPlanArtifacts.length,
                  },
                  {
                    key: 'images',
                    label: locale === 'en-US' ? 'Images' : '图片素材',
                    value: referenceImageArtifacts.length,
                  },
                  {
                    key: 'videos',
                    label: locale === 'en-US' ? 'Videos' : '视频片段',
                    value: videoArtifacts.length,
                  },
                ]}
              />
            </WorkspaceNoteCard>
            <AssetBrowserPanel
              locale={locale}
              title={copy.videoAssetsTitle}
              subtitle={copy.videoAssetsSubtitle}
              artifacts={artifacts.filter((artifact) =>
                artifact.kind === 'reference_image' ||
                artifact.kind === 'video_clip' ||
                artifact.kind === 'shot_plan'
              )}
              artifactRelations={artifactRelations}
              jobs={jobs}
            />
          </div>
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
            <WorkspaceNoteCard
              tone="blueberry"
              eyebrow={locale === 'en-US' ? 'Delivery lane' : '交付出口'}
              title={locale === 'en-US' ? 'Package the latest artifacts for handoff.' : '把最新资产整理成可交付版本。'}
              description={
                locale === 'en-US'
                  ? 'Exports are your clean outbound surface. Keep a quick browser beside them so downloading never breaks context.'
                  : '导出区是最终对外交付面，旁边保留资产浏览器能让下载和核对不脱节。'
              }
              titleAs="h3"
            >
              <WorkspaceMiniList
                items={[
                  {
                    key: 'exports',
                    label: labels.latestExports,
                    value: exportArtifacts.length,
                  },
                  {
                    key: 'assets',
                    label: copy.assetsTitle,
                    value: artifacts.length,
                  },
                ]}
              />
            </WorkspaceNoteCard>
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
          <WorkspaceNoteCard
            tone="slushie"
            eyebrow={locale === 'en-US' ? 'Operations' : '运行状态'}
            title={locale === 'en-US' ? 'Watch queue health and recover failures quickly.' : '随时看队列状态，失败了就尽快恢复。'}
            description={
              locale === 'en-US'
                ? 'This view becomes your control tower once generation starts. Retry, cancel, and confirm completion without leaving the workspace.'
                : '任务开始后，这里就是你的控制塔。重试、取消、确认完成都不需要离开工作台。'
            }
            titleAs="h3"
          >
            <WorkspaceMiniList
              items={[
                {
                  key: 'jobs',
                  label: copy.jobsTab,
                  value: jobs.length,
                },
                {
                  key: 'completed',
                  label: locale === 'en-US' ? 'Completed' : '已完成',
                  value: completedJobs.length,
                },
                {
                  key: 'latest',
                  label: locale === 'en-US' ? 'Latest job' : '最近任务',
                  value: latestJob?.kind ?? (locale === 'en-US' ? 'None yet' : '暂无'),
                },
              ]}
            />
          </WorkspaceNoteCard>
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
  labels: ProjectWorkspaceClientProps['labels']
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
      case 'video':
        return {
          title: 'Bind image assets and turn selected shots into Veo video clips.',
          description: 'Upload references, choose first and last frames, and keep generated clips beside the form.',
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
    case 'video':
      return {
        title: '把图片素材和 Veo 视频生成放在同一个工作面里。',
        description: '上传参考图、绑定首尾帧，并在旁边直接审看生成出来的视频片段。',
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
    case 'video':
      return 'storyboard';
    default:
      return 'novel';
  }
}

function getWorkflowSubtabs(
  locale: SupportedLocale,
  labels: ProjectWorkspaceClientProps['labels'],
  stage: WorkflowStageId,
  videoEnabled: boolean
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
        ...(videoEnabled
          ? [
              {
                id: 'video' as const,
                label: locale === 'en-US' ? 'Video Lab' : '视频生成',
              },
            ]
          : []),
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

type WorkspaceCapabilityCard = {
  id: 'source' | 'script' | 'storyboard' | 'delivery';
  tone: 'source' | 'script' | 'storyboard' | 'delivery';
  eyebrow: string;
  title: string;
  description: string;
  value: string;
  actionLabel: string;
  tab: WorkspaceTab;
  meta: Array<{ label: string; value: string }>;
};

function buildWorkspaceCapabilityCards(
  locale: SupportedLocale,
  input: {
    sourceCharacterCount: number;
    scriptArtifacts: GenerationArtifact[];
    storyboardArtifacts: GenerationArtifact[];
    shotPlanArtifacts: GenerationArtifact[];
    promptPackArtifacts: GenerationArtifact[];
    videoArtifacts: GenerationArtifact[];
    exportArtifacts: GenerationArtifact[];
    jobs: GenerationJob[];
    videoEnabled: boolean;
  }
): WorkspaceCapabilityCard[] {
  if (locale === 'en-US') {
    return [
      {
        id: 'source',
        tone: 'source',
        eyebrow: 'Input',
        title: 'Novel source and project settings',
        description: 'Keep the raw text, genre, episode count, and pacing settings together before generation starts.',
        value: `${input.sourceCharacterCount.toLocaleString()} chars`,
        actionLabel: 'Open source',
        tab: 'source',
        meta: [
          { label: 'draft', value: input.sourceCharacterCount > 0 ? 'ready' : 'empty' },
          { label: 'jobs', value: String(input.jobs.length) },
        ],
      },
      {
        id: 'script',
        tone: 'script',
        eyebrow: 'Writing',
        title: 'Analysis, outline, and script versions',
        description: 'Use the middle lane for planning, episode structure, and final script drafts.',
        value: `${input.scriptArtifacts.length} versions`,
        actionLabel: 'Open scripts',
        tab: 'script',
        meta: [
          { label: 'scripts', value: String(input.scriptArtifacts.length) },
          { label: 'jobs', value: String(input.jobs.filter((job) => job.kind === 'script-generation').length) },
        ],
      },
      {
        id: 'storyboard',
        tone: 'storyboard',
        eyebrow: 'Visuals',
        title: 'Storyboard, shot plan, and prompt pack review',
        description: 'Inspect the visual board, its structured shot plan, and the prompt pack used downstream.',
        value: `${input.storyboardArtifacts.length} boards`,
        actionLabel: 'Open storyboard',
        tab: 'storyboard',
        meta: [
          { label: 'plans', value: String(input.shotPlanArtifacts.length) },
          { label: 'packs', value: String(input.promptPackArtifacts.length) },
        ],
      },
      {
        id: 'delivery',
        tone: 'delivery',
        eyebrow: 'Output',
        title: input.videoEnabled ? 'Video generation and delivery' : 'Exports and delivery',
        description: input.videoEnabled
          ? 'Bind references to shots, render clips, and keep exports close to the review flow.'
          : 'Prepare downloadable outputs and keep every deliverable in one export lane.',
        value: input.videoEnabled
          ? `${input.videoArtifacts.length} clips`
          : `${input.exportArtifacts.length} exports`,
        actionLabel: input.videoEnabled ? 'Open video' : 'Open exports',
        tab: input.videoEnabled ? 'video' : 'exports',
        meta: [
          { label: input.videoEnabled ? 'exports' : 'assets', value: String(input.exportArtifacts.length) },
          { label: 'jobs', value: String(input.jobs.filter((job) => job.kind === 'video-generation' || job.kind === 'export-generation').length) },
        ],
      },
    ];
  }

  return [
    {
      id: 'source',
      tone: 'source',
      eyebrow: '输入层',
      title: '小说原文与项目设定',
      description: '把原文、题材、集数和节奏放在一起，先把生成入口整理清楚。',
      value: `${input.sourceCharacterCount.toLocaleString()} 字`,
      actionLabel: '进入原文区',
      tab: 'source',
      meta: [
        { label: '底稿', value: input.sourceCharacterCount > 0 ? '就绪' : '未填' },
        { label: '任务', value: String(input.jobs.length) },
      ],
    },
    {
      id: 'script',
      tone: 'script',
      eyebrow: '写作层',
      title: '分析稿、大纲与剧本版本',
      description: '中间工作区负责策划、分集结构和剧本草稿，方便连续推演。',
      value: `${input.scriptArtifacts.length} 个版本`,
      actionLabel: '进入剧本区',
      tab: 'script',
      meta: [
        { label: '剧本', value: String(input.scriptArtifacts.length) },
        { label: '任务', value: String(input.jobs.filter((job) => job.kind === 'script-generation').length) },
      ],
    },
    {
      id: 'storyboard',
      tone: 'storyboard',
      eyebrow: '视觉层',
      title: '分镜、镜头计划与提示词包',
      description: '把分镜成稿、结构化镜头计划和 Seedance 提示词包一起审阅，避免链路断开。',
      value: `${input.storyboardArtifacts.length} 组分镜`,
      actionLabel: '进入分镜区',
      tab: 'storyboard',
      meta: [
        { label: '镜头计划', value: String(input.shotPlanArtifacts.length) },
        { label: '提示词包', value: String(input.promptPackArtifacts.length) },
      ],
    },
    {
      id: 'delivery',
      tone: 'delivery',
      eyebrow: '输出层',
      title: input.videoEnabled ? '视频生成与交付' : '导出与交付',
      description: input.videoEnabled
        ? '把参考素材绑定到镜头上，生成视频片段，并保持交付出口就在旁边。'
        : '把最终导出集中到一个出口里，方便下载、核对和交付。',
      value: input.videoEnabled
        ? `${input.videoArtifacts.length} 个视频`
        : `${input.exportArtifacts.length} 份导出`,
      actionLabel: input.videoEnabled ? '进入视频区' : '进入导出区',
      tab: input.videoEnabled ? 'video' : 'exports',
      meta: [
        { label: input.videoEnabled ? '导出' : '资产', value: String(input.exportArtifacts.length) },
        { label: '任务', value: String(input.jobs.filter((job) => job.kind === 'video-generation' || job.kind === 'export-generation').length) },
      ],
    },
  ];
}

function buildWorkflowStages(
  locale: SupportedLocale,
  input: {
    pipelineStages: ReturnType<typeof deriveProjectPipelineStages>;
    sourceText: string;
    scriptArtifacts: GenerationArtifact[];
    storyboardArtifacts: GenerationArtifact[];
    shotPlanArtifacts: GenerationArtifact[];
    promptPackArtifacts: GenerationArtifact[];
    videoArtifacts: GenerationArtifact[];
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
          ? `${input.storyboardArtifacts.length} boards / ${input.shotPlanArtifacts.length} shot plans / ${input.promptPackArtifacts.length} prompt packs`
          : `${input.storyboardArtifacts.length} 组分镜 / ${input.shotPlanArtifacts.length} 份镜头计划 / ${input.promptPackArtifacts.length} 份提示词包`,
      stats: [
        { label: locale === 'en-US' ? 'boards' : '分镜', value: String(input.storyboardArtifacts.length) },
        { label: locale === 'en-US' ? 'plans' : '计划', value: String(input.shotPlanArtifacts.length) },
        { label: locale === 'en-US' ? 'packs' : '提示词', value: String(input.promptPackArtifacts.length) },
      ],
    },
  ];
}

function getStatusTone(status: string): WorkspaceStatusTone {
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

function getAggregateStatusTone(statuses: string[]): WorkspaceStatusTone {
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
    shotPlanCount: number;
    promptPackCount: number;
    videoCount: number;
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
        { label: locale === 'en-US' ? 'Plans' : '镜头计划', value: String(stats.shotPlanCount) },
        { label: locale === 'en-US' ? 'Packs' : '提示词包', value: String(stats.promptPackCount) },
      ];
    case 'video':
      return [
        { label: locale === 'en-US' ? 'Videos' : '视频', value: String(stats.videoCount) },
        { label: locale === 'en-US' ? 'Plans' : '镜头计划', value: String(stats.shotPlanCount) },
        { label: locale === 'en-US' ? 'Packs' : '提示词包', value: String(stats.promptPackCount) },
      ];
    case 'exports':
      return [
        { label: locale === 'en-US' ? 'Exports' : '导出', value: String(stats.exportCount) },
        { label: locale === 'en-US' ? 'Assets' : '资产', value: String(stats.artifactCount) },
        { label: locale === 'en-US' ? 'Prompt Packs' : '提示词包', value: String(stats.promptPackCount) },
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
      storyboardSubtitle: 'Inspect storyboard versions, shot plans, prompt packs, downloads, and source links.',
      videoTab: 'Video',
      videoSubtitle: 'Upload image references and turn structured shots into Veo clips.',
      videoStarted: 'Video job created',
      videoRunning: 'Generating video job...',
      videoAssetUploading: 'Uploading image asset...',
      videoAssetUploaded: 'Image asset uploaded',
      videoShotRequired: 'Choose a shot plan and a shot first.',
      videoFramePairRequired: 'First frame and last frame must be provided together.',
      videoAssetsTitle: 'Video Assets',
      videoAssetsSubtitle: 'Review shot plans, image references, and generated video clips together.',
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
    storyboardSubtitle: '浏览分镜版本、镜头计划、提示词包、下载结果和来源关系。',
    videoTab: '视频',
    videoSubtitle: '上传图片参考，并把结构化镜头直接生成 Veo 视频。',
    videoStarted: '已创建视频任务',
    videoRunning: '正在创建视频任务...',
    videoAssetUploading: '正在上传图片素材...',
    videoAssetUploaded: '图片素材上传成功',
    videoShotRequired: '请先选择镜头计划和镜头',
    videoFramePairRequired: '首帧和尾帧需要同时提供',
    videoAssetsTitle: '视频资产',
    videoAssetsSubtitle: '把镜头计划、参考图和生成出来的视频片段放在一起审阅。',
    scriptSubtitle: '编辑剧本版本，并从指定版本继续生成分镜。',
    assetsTitle: '资产浏览器',
    assetsSubtitle: '统一筛选、预览和下载项目内全部资产。',
    jobsSubtitle: '查看排队、运行、失败和完成的生成任务。',
  };
}

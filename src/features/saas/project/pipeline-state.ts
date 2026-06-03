import type {
  GenerationArtifact,
  GenerationJob,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import type { PipelineStageItem } from '@/features/saas/project/PipelineProgressBar';

type ScriptStageKind = 'analysis' | 'outline' | 'script';

export function deriveProjectPipelineStages(
  locale: SupportedLocale,
  sourceText: string,
  artifacts: GenerationArtifact[],
  jobs: GenerationJob[]
): PipelineStageItem[] {
  const latestRootJob = findLatestPipelineRootJob(jobs, artifacts);

  if (!latestRootJob) {
    return buildFallbackStages(locale, sourceText, artifacts);
  }

  if (latestRootJob.kind === 'storyboard-generation') {
    const storyboardArtifacts = artifacts.filter(
      (artifact) =>
        artifact.kind === 'storyboard' && artifact.generationJobId === latestRootJob.id
    );
    const hasStoryboardSource = Boolean(
      getStoryboardSourceSummary(locale, latestRootJob.inputSnapshot).trim()
    );

    return [
      {
        id: 'source',
        title: locale === 'en-US' ? 'Source' : '原文',
        status: sourceText.trim() ? 'succeeded' : 'pending',
        summary: summarizeSourceText(locale, sourceText),
      },
      {
        id: 'analysis',
        title: locale === 'en-US' ? 'Analysis' : '分析',
        status: 'pending',
        summary: locale === 'en-US' ? 'Pending' : '待生成',
      },
      {
        id: 'outline',
        title: locale === 'en-US' ? 'Outline' : '大纲',
        status: 'pending',
        summary: locale === 'en-US' ? 'Pending' : '待生成',
      },
      {
        id: 'script',
        title: locale === 'en-US' ? 'Script' : '剧本',
        status: hasStoryboardSource ? 'succeeded' : 'pending',
        summary: hasStoryboardSource ? getStoryboardSourceSummary(locale, latestRootJob.inputSnapshot) : locale === 'en-US' ? 'Pending' : '待生成',
      },
      {
        id: 'storyboard',
        title: locale === 'en-US' ? 'Storyboard' : '分镜',
        status: deriveJobStageStatus('storyboard', storyboardArtifacts, latestRootJob),
        summary: summarizeStage(locale, 'storyboard', storyboardArtifacts, latestRootJob),
        jobId: latestRootJob.id,
        artifactId: latestArtifactId('storyboard', storyboardArtifacts),
      },
    ];
  }

  const scriptJob = latestRootJob;
  const storyboardJob = findLinkedStoryboardJob(scriptJob, jobs, artifacts);
  const scopedScriptArtifacts = artifacts.filter(
    (artifact) => artifact.generationJobId === scriptJob.id
  );
  const storyboardArtifacts = storyboardJob
    ? artifacts.filter((artifact) => artifact.generationJobId === storyboardJob.id)
    : [];

  return [
    {
      id: 'source',
      title: locale === 'en-US' ? 'Source' : '原文',
      status: sourceText.trim() ? 'succeeded' : 'pending',
      summary: summarizeSourceText(locale, sourceText),
    },
    {
      id: 'analysis',
      title: locale === 'en-US' ? 'Analysis' : '分析',
      status: deriveJobStageStatus('analysis', scopedScriptArtifacts, scriptJob),
      summary: summarizeStage(locale, 'analysis', scopedScriptArtifacts, scriptJob),
      jobId: scriptJob.id,
      artifactId: latestArtifactId('analysis', scopedScriptArtifacts),
    },
    {
      id: 'outline',
      title: locale === 'en-US' ? 'Outline' : '大纲',
      status: deriveJobStageStatus('outline', scopedScriptArtifacts, scriptJob),
      summary: summarizeStage(locale, 'outline', scopedScriptArtifacts, scriptJob),
      jobId: scriptJob.id,
      artifactId: latestArtifactId('outline', scopedScriptArtifacts),
    },
    {
      id: 'script',
      title: locale === 'en-US' ? 'Script' : '剧本',
      status: deriveJobStageStatus('script', scopedScriptArtifacts, scriptJob),
      summary: summarizeStage(locale, 'script', scopedScriptArtifacts, scriptJob),
      jobId: scriptJob.id,
      artifactId: latestArtifactId('script', scopedScriptArtifacts),
    },
    {
      id: 'storyboard',
      title: locale === 'en-US' ? 'Storyboard' : '分镜',
      status: deriveJobStageStatus('storyboard', storyboardArtifacts, storyboardJob),
      summary: summarizeStage(locale, 'storyboard', storyboardArtifacts, storyboardJob),
      jobId: storyboardJob?.id ?? null,
      artifactId: latestArtifactId('storyboard', storyboardArtifacts),
    },
  ];
}

export function deriveJobPipelineStages(
  job: GenerationJob,
  jobs: GenerationJob[]
): PipelineStageItem[] {
  if (job.kind === 'script-generation' && readJobMetadata(job).pipelineMode === 'novel-to-storyboard') {
    const storyboardJob = findLinkedStoryboardJob(job, jobs);
    return [
      {
        id: `${job.id}:script`,
        title: 'Script',
        status: mapStandaloneJobStatus(job),
        summary: job.currentStep ?? job.outputSummary ?? 'Script stage',
        jobId: job.id,
      },
      {
        id: `${job.id}:storyboard`,
        title: 'Storyboard',
        status: storyboardJob ? mapStandaloneJobStatus(storyboardJob) : 'pending',
        summary:
          storyboardJob?.currentStep ??
          storyboardJob?.outputSummary ??
          (job.status === 'failed' || job.status === 'cancelled'
            ? 'Stopped before storyboard stage'
            : 'Waiting for storyboard stage'),
        jobId: storyboardJob?.id ?? null,
      },
    ];
  }

  const { upstreamJobId } = readJobMetadata(job);
  if (job.kind === 'storyboard-generation' && upstreamJobId) {
    const scriptJob = jobs.find((candidate) => candidate.id === upstreamJobId);
    return [
      {
        id: `${job.id}:script`,
        title: 'Script',
        status: scriptJob ? mapStandaloneJobStatus(scriptJob) : 'succeeded',
        summary: scriptJob?.currentStep ?? scriptJob?.outputSummary ?? 'Script stage',
        jobId: scriptJob?.id ?? upstreamJobId,
      },
      {
        id: `${job.id}:storyboard`,
        title: 'Storyboard',
        status: mapStandaloneJobStatus(job),
        summary: job.currentStep ?? job.outputSummary ?? 'Storyboard stage',
        jobId: job.id,
      },
    ];
  }

  return [];
}

export function summarizeJobFailure(
  locale: SupportedLocale,
  job: GenerationJob
): string | null {
  if (job.status !== 'failed') {
    return null;
  }

  const metadata = readJobMetadata(job);
  const stage =
    job.kind === 'storyboard-generation'
      ? locale === 'en-US'
        ? 'Storyboard stage failed'
        : '分镜阶段失败'
      : metadata.pipelineMode === 'novel-to-storyboard'
        ? locale === 'en-US'
          ? 'Script stage failed'
          : '剧本阶段失败'
        : locale === 'en-US'
          ? 'Generation failed'
          : '生成失败';

  const reason = job.errorMessage?.trim() || job.currentStep?.trim();
  return reason ? `${stage}: ${reason}` : stage;
}

function buildFallbackStages(
  locale: SupportedLocale,
  sourceText: string,
  artifacts: GenerationArtifact[]
): PipelineStageItem[] {
  return [
    {
      id: 'source',
      title: locale === 'en-US' ? 'Source' : '原文',
      status: sourceText.trim() ? 'succeeded' : 'pending',
      summary: summarizeSourceText(locale, sourceText),
    },
    {
      id: 'analysis',
      title: locale === 'en-US' ? 'Analysis' : '分析',
      status: artifacts.some((artifact) => artifact.kind === 'analysis') ? 'succeeded' : 'pending',
      summary: summarizeArtifactCount(locale, 'analysis', artifacts),
      artifactId: latestArtifactId('analysis', artifacts),
    },
    {
      id: 'outline',
      title: locale === 'en-US' ? 'Outline' : '大纲',
      status: artifacts.some((artifact) => artifact.kind === 'outline') ? 'succeeded' : 'pending',
      summary: summarizeArtifactCount(locale, 'outline', artifacts),
      artifactId: latestArtifactId('outline', artifacts),
    },
    {
      id: 'script',
      title: locale === 'en-US' ? 'Script' : '剧本',
      status: artifacts.some((artifact) => artifact.kind === 'script') ? 'succeeded' : 'pending',
      summary: summarizeArtifactCount(locale, 'script', artifacts),
      artifactId: latestArtifactId('script', artifacts),
    },
    {
      id: 'storyboard',
      title: locale === 'en-US' ? 'Storyboard' : '分镜',
      status: artifacts.some((artifact) => artifact.kind === 'storyboard') ? 'succeeded' : 'pending',
      summary: summarizeArtifactCount(locale, 'storyboard', artifacts),
      artifactId: latestArtifactId('storyboard', artifacts),
    },
  ];
}

function summarizeArtifactCount(
  locale: SupportedLocale,
  kind: GenerationArtifact['kind'],
  artifacts: GenerationArtifact[]
) {
  const count = artifacts.filter((artifact) => artifact.kind === kind).length;
  if (count === 0) {
    return locale === 'en-US' ? 'Pending' : '待生成';
  }

  return locale === 'en-US'
    ? `${count} artifact${count === 1 ? '' : 's'}`
    : `${count} 个产物`;
}

function findLatestPipelineRootJob(jobs: GenerationJob[], artifacts: GenerationArtifact[]) {
  return [...jobs]
    .filter(
      (job) =>
        job.kind === 'script-generation' ||
        (job.kind === 'storyboard-generation' && !getStoryboardUpstreamJobId(job, artifacts))
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function findLinkedStoryboardJob(
  scriptJob: GenerationJob,
  jobs: GenerationJob[],
  artifacts: GenerationArtifact[] = []
) {
  return [...jobs]
    .filter((job) => job.kind === 'storyboard-generation')
    .filter((job) => getStoryboardUpstreamJobId(job, artifacts) === scriptJob.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function getStoryboardUpstreamJobId(
  job: GenerationJob,
  artifacts: GenerationArtifact[]
) {
  const metadataUpstreamJobId = readJobMetadata(job).upstreamJobId;
  if (metadataUpstreamJobId || job.kind !== 'storyboard-generation') {
    return metadataUpstreamJobId;
  }

  const sourceArtifactIds = readStoryboardSourceArtifactIds(job);
  if (sourceArtifactIds.length === 0) {
    return null;
  }

  const sourceJobIds = new Set(
    sourceArtifactIds
      .map((artifactId) => artifacts.find((artifact) => artifact.id === artifactId))
      .filter(
        (artifact): artifact is GenerationArtifact =>
          Boolean(artifact) && artifact?.kind === 'script'
      )
      .map((artifact) => artifact.generationJobId)
      .filter(Boolean)
  );

  return sourceJobIds.size === 1 ? Array.from(sourceJobIds)[0] : null;
}

function readStoryboardSourceArtifactIds(job: GenerationJob) {
  const payload = asRecord(job.inputSnapshot?.payload);
  const selection = asRecord(payload.selection);
  return Array.from(
    new Set([
      ...readStringArray(payload.scriptArtifactIds),
      ...readStringArray(selection.artifactIds),
    ])
  );
}

function deriveJobStageStatus(
  kind: ScriptStageKind | 'storyboard',
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

  if (kind === 'storyboard') {
    return mapStandaloneJobStatus(job);
  }

  if (job.status === 'queued') {
    return stageReachedInScriptJob(kind, job.currentStep) ? 'queued' : 'pending';
  }

  if (job.status === 'running') {
    return stageReachedInScriptJob(kind, job.currentStep) ? 'running' : 'pending';
  }

  if (job.status === 'failed') {
    return stageReachedInScriptJob(kind, job.currentStep) ? 'failed' : 'pending';
  }

  if (job.status === 'cancelled') {
    return stageReachedInScriptJob(kind, job.currentStep) ? 'cancelled' : 'pending';
  }

  return 'pending';
}

function summarizeStage(
  locale: SupportedLocale,
  kind: ScriptStageKind | 'storyboard',
  artifacts: GenerationArtifact[],
  job: GenerationJob | null
) {
  const matchingArtifacts = artifacts.filter((artifact) => artifact.kind === kind);
  if (matchingArtifacts.length > 0) {
    return locale === 'en-US'
      ? `${matchingArtifacts.length} artifact${matchingArtifacts.length === 1 ? '' : 's'}`
      : `${matchingArtifacts.length} 个产物`;
  }

  if (kind === 'storyboard' && job?.kind === 'storyboard-generation') {
    if (job.status === 'failed') {
      return formatStageFailureSummary(locale, kind, job);
    }
    return job.currentStep ?? job.outputSummary ?? (locale === 'en-US' ? 'Pending' : '待生成');
  }

  if (job?.status === 'failed' && kind !== 'storyboard' && stageReachedInScriptJob(kind, job.currentStep)) {
    return formatStageFailureSummary(locale, kind, job);
  }

  if (job?.currentStep && kind !== 'storyboard') {
    return stageReachedInScriptJob(kind, job.currentStep)
      ? job.currentStep
      : locale === 'en-US'
        ? 'Pending'
        : '待生成';
  }

  return locale === 'en-US' ? 'Pending' : '待生成';
}

function formatStageFailureSummary(
  locale: SupportedLocale,
  kind: ScriptStageKind | 'storyboard',
  job: GenerationJob
) {
  const reason = job.errorMessage?.trim();
  if (reason) {
    return locale === 'en-US'
      ? `${getStageLabel(locale, kind)} failed: ${reason}`
      : `${getStageLabel(locale, kind)}失败：${reason}`;
  }

  return locale === 'en-US'
    ? `${getStageLabel(locale, kind)} failed`
    : `${getStageLabel(locale, kind)}失败`;
}

function getStageLabel(locale: SupportedLocale, kind: ScriptStageKind | 'storyboard') {
  if (locale === 'en-US') {
    return kind === 'analysis'
      ? 'Analysis'
      : kind === 'outline'
        ? 'Outline'
        : kind === 'script'
          ? 'Script'
          : 'Storyboard';
  }

  return kind === 'analysis'
    ? '分析'
    : kind === 'outline'
      ? '大纲'
      : kind === 'script'
        ? '剧本'
        : '分镜';
}

function stageReachedInScriptJob(kind: ScriptStageKind, currentStep?: string | null) {
  if (!currentStep) {
    return kind === 'analysis';
  }

  if (kind === 'analysis') {
    return (
      ['preprocessing', 'analyzing', 'analyzed', 'outlining', 'outlined', 'generating', 'done'].includes(currentStep) ||
      currentStep.startsWith('generating_episode_')
    );
  }

  if (kind === 'outline') {
    return (
      ['outlining', 'outlined', 'generating', 'done'].includes(currentStep) ||
      currentStep.startsWith('generating_episode_')
    );
  }

  return currentStep === 'generating' || currentStep === 'done' || currentStep.startsWith('generating_episode_');
}

function getStoryboardSourceSummary(locale: SupportedLocale, snapshot: Record<string, unknown>) {
  const payload = asRecord(snapshot.payload);
  const scriptArtifactIds = Array.isArray(payload.scriptArtifactIds)
    ? payload.scriptArtifactIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  if (scriptArtifactIds.length > 0) {
    return locale === 'en-US'
      ? `${scriptArtifactIds.length} script artifact${scriptArtifactIds.length === 1 ? '' : 's'}`
      : `${scriptArtifactIds.length} 个剧本产物`;
  }

  const scriptText = typeof payload.scriptText === 'string' ? payload.scriptText.trim() : '';
  return scriptText ? (locale === 'en-US' ? 'Manual script text' : '手动填写剧本文本') : '';
}

function summarizeSourceText(locale: SupportedLocale, sourceText: string) {
  if (!sourceText.trim()) {
    return locale === 'en-US' ? 'Source text required' : '需要先填写原文';
  }

  return locale === 'en-US'
    ? `${sourceText.length} chars ready`
    : `已准备 ${sourceText.length} 个字符`;
}

function latestArtifactId(kind: GenerationArtifact['kind'], artifacts: GenerationArtifact[]) {
  return [...artifacts]
    .filter((artifact) => artifact.kind === kind)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.version - left.version)[0]?.id ?? null;
}

function mapStandaloneJobStatus(job: GenerationJob): PipelineStageItem['status'] {
  switch (job.status) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function readJobMetadata(job: GenerationJob) {
  const metadata = asRecord(job.inputSnapshot?.metadata);
  return {
    pipelineMode:
      typeof metadata.pipelineMode === 'string' ? metadata.pipelineMode : null,
    upstreamJobId:
      typeof metadata.upstreamJobId === 'string' ? metadata.upstreamJobId : null,
  };
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

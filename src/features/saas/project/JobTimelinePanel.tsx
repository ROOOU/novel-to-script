'use client';

import { useState } from 'react';
import {
  WorkspaceListRow,
  WorkspaceStatusPill,
} from '@/components/WorkspaceUI';
import type {
  GenerationArtifact,
  GenerationJob,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import {
  PipelineProgressBar,
  type PipelineStageItem,
} from '@/features/saas/project/PipelineProgressBar';
import {
  deriveJobPipelineStages,
  summarizeJobFailure,
} from '@/features/saas/project/pipeline-state';
import {
  formatJobKind,
  formatJobStatus,
  formatLocaleDateTime,
} from '@/features/saas/project/presentation';
import {
  formatAnalysisStrategyLabel,
  formatExecutionBehaviorSummary,
  formatExecutionModeLabel,
  formatOutlineStrategyLabel,
  formatScriptStrategyLabel,
  readMergedScriptDiagnostics,
} from '@/features/saas/project/job-diagnostics';

interface JobTimelinePanelProps {
  locale: SupportedLocale;
  title: string;
  subtitle?: string;
  jobs: GenerationJob[];
  artifacts?: GenerationArtifact[];
  pipelineStages?: PipelineStageItem[];
  onRetryJob?: (job: GenerationJob) => Promise<void> | void;
  onCancelJob?: (job: GenerationJob) => Promise<void> | void;
  labels?: Partial<{
    emptyState: string;
    stageSummary: string;
    stagePlaceholder: string;
    startedAt: string;
    finishedAt: string;
    progress: string;
    reservedCredits: string;
    settledCredits: string;
    jobId: string;
    retry: string;
    retrying: string;
    cancel: string;
    cancelling: string;
    inputSnapshot: string;
    diagnostics: string;
    diagnosticsStructured: string;
    diagnosticsTextDerived: string;
    diagnosticsPartialTextDerived: string;
    diagnosticsParseError: string;
    diagnosticsRecoveredShots: string;
    diagnosticsShotCount: string;
    scriptDiagnostics: string;
    scriptDiagnosticsDirect: string;
    scriptDiagnosticsSegmented: string;
    scriptDiagnosticsFallback: string;
    scriptDiagnosticsReused: string;
    scriptDiagnosticsChunkCount: string;
    scriptDiagnosticsAnalyzedChunkCount: string;
    scriptDiagnosticsOutlinedChunkCount: string;
    scriptDiagnosticsComplexity: string;
    scriptDiagnosticsOutlineFallback: string;
    scriptDiagnosticsSegmentedScript: string;
    scriptDiagnosticsSingleScript: string;
    scriptDiagnosticsSourceChunk: string;
  }>;
}

export function JobTimelinePanel({
  locale,
  title,
  subtitle,
  jobs,
  artifacts = [],
  pipelineStages,
  onRetryJob,
  onCancelJob,
  labels,
}: JobTimelinePanelProps) {
  const mergedLabels = { ...getDefaultLabels(locale), ...labels };
  const orderedJobs = [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const hasPipeline = Boolean(pipelineStages?.length);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [actionErrorByJobId, setActionErrorByJobId] = useState<Record<string, string>>({});

  async function handleAction(job: GenerationJob, action: 'retry' | 'cancel') {
    const actionHandler = action === 'retry' ? onRetryJob : onCancelJob;
    if (!actionHandler) {
      return;
    }

    const actionKey = `${action}:${job.id}`;
    setPendingActionKey(actionKey);
    setActionErrorByJobId((current) => {
      const next = { ...current };
      delete next[job.id];
      return next;
    });

    try {
      await actionHandler(job);
    } catch (error) {
      setActionErrorByJobId((current) => ({
        ...current,
        [job.id]: error instanceof Error ? error.message : `${action} failed`,
      }));
    } finally {
      setPendingActionKey((current) => (current === actionKey ? null : current));
    }
  }

  return (
    <article className="card stack-gap job-timeline-panel">
      <div className="stack-gap-sm">
        <WorkspaceListRow>
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <span className="chip">{orderedJobs.length}</span>
        </WorkspaceListRow>
      </div>

      {hasPipeline ? (
        <PipelineProgressBar
          locale={locale}
          title={mergedLabels.stageSummary}
          subtitle={subtitle}
          stages={pipelineStages ?? []}
          emptyLabel={mergedLabels.stagePlaceholder}
        />
      ) : null}

      {orderedJobs.length === 0 ? (
        <p className="helper-text">{mergedLabels.emptyState}</p>
      ) : (
        <div className="timeline-list">
          {orderedJobs.map((job, index) => {
            const statusTone = getJobStatusTone(job.status);
            const progress = clampPercent(job.progress);
            const startedAt = formatLocaleDateTime(locale, job.startedAt);
            const finishedAt = formatLocaleDateTime(locale, job.finishedAt);
            const summary = job.outputSummary?.trim() || mergedLabels.stagePlaceholder;
            const pipelineStagesForJob = deriveJobPipelineStages(job, jobs);
            const failureSummary = summarizeJobFailure(locale, job);
            const scriptDiagnostics = readJobScriptDiagnostics(job, jobs, artifacts);
            const storyboardArtifact = findLatestArtifactForJob(artifacts, job.id, 'storyboard');
            const storyboardDiagnostics = readStoryboardDiagnostics(storyboardArtifact?.metadata);
            const canRetry = job.status === 'failed' || job.status === 'cancelled';
            const canCancel = job.status === 'queued' || job.status === 'running';
            const retryActionKey = `retry:${job.id}`;
            const cancelActionKey = `cancel:${job.id}`;

            return (
              <div key={job.id} className="timeline-row">
                <div className="timeline-marker" data-tone={statusTone} />
                <article className="timeline-card">
                  <div className="timeline-card-header">
                    <div>
                      <div className="timeline-card-topline">
                        <strong>{formatJobKind(locale, job.kind)}</strong>
                        <WorkspaceStatusPill tone={statusTone}>
                          {formatJobStatus(locale, job.status)}
                        </WorkspaceStatusPill>
                      </div>
                      <p className="timeline-step">
                        {job.currentStep ?? mergedLabels.stagePlaceholder}
                      </p>
                    </div>
                    <div className="timeline-card-meta">
                      <span>{`#${index + 1}`}</span>
                      <span>{`${mergedLabels.progress} ${progress}%`}</span>
                    </div>
                  </div>

                  <div className="timeline-progress-track" aria-hidden="true">
                    <div className="timeline-progress-fill" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="timeline-summary">
                    <strong>{mergedLabels.stageSummary}</strong>
                    <p>{summary}</p>
                  </div>

                  {scriptDiagnostics ? (
                    <div className="source-job-card">
                      <WorkspaceListRow>
                        <strong>{mergedLabels.scriptDiagnostics}</strong>
                        <WorkspaceStatusPill
                          tone={scriptDiagnostics.executionMode === 'segmented' ? 'running' : 'success'}
                        >
                          {formatExecutionModeLabel(locale, scriptDiagnostics.executionMode)}
                        </WorkspaceStatusPill>
                      </WorkspaceListRow>
                      <p className="helper-text">
                        {formatExecutionBehaviorSummary(locale, scriptDiagnostics)}
                      </p>
                      <p className="helper-text">
                        {[
                          `${mergedLabels.scriptDiagnosticsChunkCount} ${scriptDiagnostics.chunkCount}`,
                          `${mergedLabels.scriptDiagnosticsAnalyzedChunkCount} ${scriptDiagnostics.analyzedChunkCount}`,
                          scriptDiagnostics.outlinedChunkCount > 0
                            ? `${mergedLabels.scriptDiagnosticsOutlinedChunkCount} ${scriptDiagnostics.outlinedChunkCount}`
                            : null,
                          scriptDiagnostics.analysisStrategy === 'segmented_fallback_single'
                            ? mergedLabels.scriptDiagnosticsFallback
                            : null,
                          scriptDiagnostics.outlineStrategy === 'segmented_fallback_single'
                            ? mergedLabels.scriptDiagnosticsOutlineFallback
                            : null,
                          scriptDiagnostics.analysisStrategy === 'reused'
                            ? mergedLabels.scriptDiagnosticsReused
                            : null,
                          scriptDiagnostics.scriptStrategy === 'segmented'
                            ? mergedLabels.scriptDiagnosticsSegmentedScript
                            : scriptDiagnostics.scriptStrategy === 'single'
                              ? mergedLabels.scriptDiagnosticsSingleScript
                              : null,
                          scriptDiagnostics.analysisStrategy
                            ? `${locale === 'en-US' ? 'Analysis' : '分析'} ${formatAnalysisStrategyLabel(locale, scriptDiagnostics.analysisStrategy)}`
                            : null,
                          scriptDiagnostics.outlineStrategy
                            ? `${locale === 'en-US' ? 'Outline' : '大纲'} ${formatOutlineStrategyLabel(locale, scriptDiagnostics.outlineStrategy)}`
                            : null,
                          scriptDiagnostics.scriptStrategy
                            ? `${locale === 'en-US' ? 'Script' : '剧本'} ${formatScriptStrategyLabel(locale, scriptDiagnostics.scriptStrategy)}`
                            : null,
                          scriptDiagnostics.sourceChunkIndex !== null
                            ? `${mergedLabels.scriptDiagnosticsSourceChunk} ${scriptDiagnostics.sourceChunkIndex}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  ) : null}

                  {storyboardDiagnostics ? (
                    <div className="source-job-card">
                      <WorkspaceListRow>
                        <strong>{mergedLabels.diagnostics}</strong>
                        <WorkspaceStatusPill
                          tone={
                            storyboardDiagnostics.parseError || storyboardDiagnostics.invalidShotIndexes.length > 0
                              ? 'danger'
                              : storyboardDiagnostics.fallbackMode
                                ? 'running'
                                : 'success'
                          }
                        >
                          {storyboardDiagnostics.fallbackMode
                            ? formatFallbackModeLabel(mergedLabels, storyboardDiagnostics.fallbackMode)
                            : mergedLabels.diagnosticsStructured}
                        </WorkspaceStatusPill>
                      </WorkspaceListRow>
                      <p className="helper-text">
                        {[
                          `${mergedLabels.diagnosticsShotCount} ${storyboardDiagnostics.shotCount}`,
                          storyboardDiagnostics.invalidShotIndexes.length > 0
                            ? `${mergedLabels.diagnosticsRecoveredShots} ${storyboardDiagnostics.invalidShotIndexes
                                .map((index) => index + 1)
                                .join(', ')}`
                            : null,
                          storyboardDiagnostics.parseError
                            ? `${mergedLabels.diagnosticsParseError} ${storyboardDiagnostics.parseError}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  ) : null}

                  {pipelineStagesForJob.length > 0 ? (
                    <PipelineProgressBar
                      locale={locale}
                      title={locale === 'en-US' ? 'Pipeline chain' : '任务链路'}
                      stages={pipelineStagesForJob}
                      emptyLabel={mergedLabels.stagePlaceholder}
                    />
                  ) : null}

                  <div className="timeline-meta-grid">
                    <div className="timeline-meta-card">
                      <span>{mergedLabels.jobId}</span>
                      <strong>{shortenId(job.id)}</strong>
                    </div>
                    <div className="timeline-meta-card">
                      <span>{mergedLabels.startedAt}</span>
                      <strong>{startedAt}</strong>
                    </div>
                    <div className="timeline-meta-card">
                      <span>{mergedLabels.finishedAt}</span>
                      <strong>{finishedAt}</strong>
                    </div>
                    <div className="timeline-meta-card">
                      <span>{mergedLabels.reservedCredits}</span>
                      <strong>{job.reservedCredits ?? 0}</strong>
                    </div>
                  </div>

                  <div className="timeline-meta-grid timeline-meta-grid-secondary">
                    <div className="timeline-meta-card">
                      <span>{mergedLabels.settledCredits}</span>
                      <strong>{job.settledCredits ?? 0}</strong>
                    </div>
                    <div className="timeline-meta-card timeline-meta-card-full">
                      <span>{mergedLabels.inputSnapshot}</span>
                      <strong>{renderSnapshotSummary(job.inputSnapshot)}</strong>
                    </div>
                  </div>

                  {failureSummary ? (
                    <p className="error-message timeline-error">{failureSummary}</p>
                  ) : null}

                  {job.errorMessage && failureSummary !== job.errorMessage ? (
                    <p className="helper-text">{job.errorMessage}</p>
                  ) : null}

                  {actionErrorByJobId[job.id] ? (
                    <p className="error-message timeline-error">{actionErrorByJobId[job.id]}</p>
                  ) : null}

                  {canRetry || canCancel ? (
                    <div className="action-row">
                      {canRetry ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={pendingActionKey !== null}
                          onClick={() => void handleAction(job, 'retry')}
                        >
                          {pendingActionKey === retryActionKey ? mergedLabels.retrying : mergedLabels.retry}
                        </button>
                      ) : null}
                      {canCancel ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={pendingActionKey !== null}
                          onClick={() => void handleAction(job, 'cancel')}
                        >
                          {pendingActionKey === cancelActionKey ? mergedLabels.cancelling : mergedLabels.cancel}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function getDefaultLabels(locale: SupportedLocale) {
  if (locale === 'en-US') {
    return {
      emptyState: 'No jobs yet.',
      stageSummary: 'Stage summary',
      stagePlaceholder: 'Pipeline summary pending.',
      startedAt: 'Started',
      finishedAt: 'Finished',
      progress: 'Progress',
      reservedCredits: 'Reserved',
      settledCredits: 'Settled',
      jobId: 'Job',
      retry: 'Retry',
      retrying: 'Retrying...',
      cancel: 'Cancel',
      cancelling: 'Cancelling...',
      inputSnapshot: 'Input snapshot',
      diagnostics: 'Storyboard diagnostics',
      diagnosticsStructured: 'Structured JSON',
      diagnosticsTextDerived: 'Text-derived fallback',
      diagnosticsPartialTextDerived: 'Partial text-derived fallback',
      diagnosticsParseError: 'Parse signal',
      diagnosticsRecoveredShots: 'Recovered shots',
      diagnosticsShotCount: 'Shot count',
      scriptDiagnostics: 'Script diagnostics',
      scriptDiagnosticsDirect: 'Direct execution',
      scriptDiagnosticsSegmented: 'Segmented execution',
      scriptDiagnosticsFallback: 'Fallback to single-pass analysis',
      scriptDiagnosticsReused: 'Reused analysis',
      scriptDiagnosticsChunkCount: 'Chunks',
      scriptDiagnosticsAnalyzedChunkCount: 'Analyzed chunks',
      scriptDiagnosticsOutlinedChunkCount: 'Outlined chunks',
      scriptDiagnosticsComplexity: 'Complexity',
      scriptDiagnosticsOutlineFallback: 'Fallback to single-pass outline',
      scriptDiagnosticsSegmentedScript: 'Segmented script',
      scriptDiagnosticsSingleScript: 'Single-pass script',
      scriptDiagnosticsSourceChunk: 'Source chunk',
    };
  }

  return {
    emptyState: '还没有任务。',
    stageSummary: '阶段摘要',
    stagePlaceholder: '任务链路摘要待生成。',
    startedAt: '开始时间',
    finishedAt: '完成时间',
    progress: '进度',
    reservedCredits: '预留积分',
    settledCredits: '结算积分',
    jobId: '任务',
    retry: '重试',
    retrying: '正在重试...',
    cancel: '取消',
    cancelling: '正在取消...',
    inputSnapshot: '输入快照',
    diagnostics: '分镜诊断',
    diagnosticsStructured: '结构化 JSON',
    diagnosticsTextDerived: '文本兜底',
    diagnosticsPartialTextDerived: '局部文本补位',
    diagnosticsParseError: '解析信号',
    diagnosticsRecoveredShots: '补位镜头',
    diagnosticsShotCount: '镜头数量',
    scriptDiagnostics: '脚本诊断',
    scriptDiagnosticsDirect: '直接执行',
    scriptDiagnosticsSegmented: '分段执行',
    scriptDiagnosticsFallback: '已回退到单次分析',
    scriptDiagnosticsReused: '复用已有分析',
    scriptDiagnosticsChunkCount: '分块数量',
    scriptDiagnosticsAnalyzedChunkCount: '已分析分块',
    scriptDiagnosticsOutlinedChunkCount: '已生成大纲分块',
    scriptDiagnosticsComplexity: '复杂度',
    scriptDiagnosticsOutlineFallback: '已回退到单次大纲',
    scriptDiagnosticsSegmentedScript: '分段剧本',
    scriptDiagnosticsSingleScript: '单次剧本',
    scriptDiagnosticsSourceChunk: '来源分块',
  };
}

function getJobStatusTone(status: GenerationJob['status']) {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'danger';
    case 'running':
      return 'running';
    case 'cancelled':
      return 'muted';
    default:
      return 'pending';
  }
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function shortenId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function findLatestArtifactForJob(
  artifacts: GenerationArtifact[],
  jobId: string,
  kind: GenerationArtifact['kind']
) {
  return artifacts
    .filter((artifact) => artifact.generationJobId === jobId && artifact.kind === kind)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.version - left.version)[0] ?? null;
}

function readJobScriptDiagnostics(
  job: GenerationJob,
  jobs: GenerationJob[],
  artifacts: GenerationArtifact[]
) {
  const upstreamJobId = readUpstreamJobId(job.inputSnapshot);
  const relevantJobIds = upstreamJobId ? [job.id, upstreamJobId] : [job.id];
  const diagnosticsArtifacts = relevantJobIds.flatMap((jobId) =>
    ['analysis', 'outline', 'script'].flatMap((kind) => {
      const artifact = findLatestArtifactForJob(artifacts, jobId, kind as GenerationArtifact['kind']);
      return artifact ? [artifact] : [];
    })
  );

  if (upstreamJobId && !jobs.some((entry) => entry.id === upstreamJobId)) {
    return readMergedScriptDiagnostics(diagnosticsArtifacts.map((artifact) => artifact.metadata));
  }

  return readMergedScriptDiagnostics(diagnosticsArtifacts.map((artifact) => artifact.metadata));
}

function readUpstreamJobId(snapshot: Record<string, unknown>) {
  const metadata =
    snapshot.metadata && typeof snapshot.metadata === 'object'
      ? (snapshot.metadata as Record<string, unknown>)
      : null;
  return typeof metadata?.upstreamJobId === 'string' && metadata.upstreamJobId.trim().length > 0
    ? metadata.upstreamJobId.trim()
    : null;
}

function readStoryboardDiagnostics(metadata: GenerationArtifact['metadata'] | undefined) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const fallbackMode: 'text-derived' | 'partial-text-derived' | null =
    metadata.parseFallbackMode === 'text-derived' || metadata.parseFallbackMode === 'partial-text-derived'
      ? metadata.parseFallbackMode
      : null;
  const parseError =
    typeof metadata.parseError === 'string' && metadata.parseError.trim().length > 0
      ? metadata.parseError.trim()
      : null;
  const invalidShotIndexes = Array.isArray(metadata.invalidShotIndexes)
    ? metadata.invalidShotIndexes.filter((item): item is number => typeof item === 'number' && Number.isInteger(item))
    : [];
  const shotCount =
    typeof metadata.shotCount === 'number' && Number.isFinite(metadata.shotCount)
      ? metadata.shotCount
      : Array.isArray(metadata.shots)
        ? metadata.shots.length
        : 0;

  if (!fallbackMode && !parseError && invalidShotIndexes.length === 0 && shotCount === 0) {
    return null;
  }

  return { fallbackMode, parseError, invalidShotIndexes, shotCount };
}

function formatFallbackModeLabel(
  labels: ReturnType<typeof getDefaultLabels> & NonNullable<JobTimelinePanelProps['labels']>,
  mode: 'text-derived' | 'partial-text-derived'
) {
  return mode === 'partial-text-derived'
    ? labels.diagnosticsPartialTextDerived
    : labels.diagnosticsTextDerived;
}

function renderSnapshotSummary(snapshot: Record<string, unknown>) {
  const payload = asRecord(snapshot.payload);
  const metadata = asRecord(snapshot.metadata);
  const preferredParts = [
    metadata.pipelineMode ? `pipeline: ${summarizeValue(metadata.pipelineMode)}` : null,
    payload.kind ? `kind: ${summarizeValue(payload.kind)}` : null,
    payload.scriptArtifactIds ? `scriptArtifactIds: ${summarizeValue(payload.scriptArtifactIds)}` : null,
    payload.scriptText ? `scriptText: ${summarizeValue(payload.scriptText)}` : null,
    payload.text ? `text: ${summarizeValue(payload.text)}` : null,
  ].filter((part): part is string => Boolean(part));

  if (preferredParts.length > 0) {
    return preferredParts.join(' · ');
  }

  const keys = Object.keys(snapshot);
  if (keys.length === 0) {
    return 'No snapshot data';
  }

  return keys.slice(0, 3).map((key) => `${key}: ${summarizeValue(snapshot[key])}`).join(' · ');
}

function summarizeValue(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }

  if (value && typeof value === 'object') {
    return 'object';
  }

  if (typeof value === 'string') {
    return value.length > 42 ? `${value.slice(0, 42)}…` : value;
  }

  if (value === null || typeof value === 'undefined') {
    return '—';
  }

  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

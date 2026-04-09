'use client';

import { useState } from 'react';
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
  }>;
}

const DEFAULT_LABELS = {
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
};

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
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
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
        <div className="list-row">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <span className="chip">{orderedJobs.length}</span>
        </div>
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
                        <span className={`status-pill status-pill-${statusTone}`}>
                          {formatJobStatus(locale, job.status)}
                        </span>
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

                  {storyboardDiagnostics ? (
                    <div className="source-job-card">
                      <div className="list-row">
                        <strong>{mergedLabels.diagnostics}</strong>
                        <span
                          className={`status-pill status-pill-${
                            storyboardDiagnostics.parseError || storyboardDiagnostics.invalidShotIndexes.length > 0
                              ? 'danger'
                              : storyboardDiagnostics.fallbackMode
                                ? 'running'
                                : 'success'
                          }`}
                        >
                          {storyboardDiagnostics.fallbackMode
                            ? formatFallbackModeLabel(mergedLabels, storyboardDiagnostics.fallbackMode)
                            : mergedLabels.diagnosticsStructured}
                        </span>
                      </div>
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
  labels: typeof DEFAULT_LABELS & NonNullable<JobTimelinePanelProps['labels']>,
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

'use client';

import { useState } from 'react';
import type { GenerationJob } from '@/server/shared/platform/domain';
import {
  PipelineProgressBar,
  type PipelineStageItem,
} from '@/features/saas/project/PipelineProgressBar';

interface JobTimelinePanelProps {
  title: string;
  subtitle?: string;
  jobs: GenerationJob[];
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
};

export function JobTimelinePanel({
  title,
  subtitle,
  jobs,
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
            const startedAt = formatTimestamp(job.startedAt);
            const finishedAt = formatTimestamp(job.finishedAt);
            const summary = job.outputSummary?.trim() || mergedLabels.stagePlaceholder;
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
                        <strong>{humanizeJobKind(job.kind)}</strong>
                        <span className={`status-pill status-pill-${statusTone}`}>{job.status}</span>
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
                      <span>Input snapshot</span>
                      <strong>{renderSnapshotSummary(job.inputSnapshot)}</strong>
                    </div>
                  </div>

                  {job.errorMessage ? (
                    <p className="error-message timeline-error">{job.errorMessage}</p>
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
                          {pendingActionKey === retryActionKey ? 'Retrying...' : 'Retry'}
                        </button>
                      ) : null}
                      {canCancel ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={pendingActionKey !== null}
                          onClick={() => void handleAction(job, 'cancel')}
                        >
                          {pendingActionKey === cancelActionKey ? 'Cancelling...' : 'Cancel'}
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

function humanizeJobKind(kind: GenerationJob['kind']) {
  switch (kind) {
    case 'analysis-generation':
      return 'Analysis';
    case 'export-generation':
      return 'Export';
    case 'script-generation':
      return 'Script';
    case 'storyboard-generation':
      return 'Storyboard';
    default:
      return kind;
  }
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

function formatTimestamp(value?: string | null) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function shortenId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function renderSnapshotSummary(snapshot: Record<string, unknown>) {
  const keys = Object.keys(snapshot);
  if (keys.length === 0) {
    return 'No snapshot data';
  }

  const preferredKeys = ['pipelineMode', 'kind', 'payload', 'scriptArtifactIds', 'scriptText'];
  const parts = preferredKeys
    .filter((key) => key in snapshot)
    .map((key) => `${key}: ${summarizeValue(snapshot[key])}`);

  if (parts.length === 0) {
    return keys.slice(0, 3).map((key) => `${key}: ${summarizeValue(snapshot[key])}`).join(' · ');
  }

  return parts.join(' · ');
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

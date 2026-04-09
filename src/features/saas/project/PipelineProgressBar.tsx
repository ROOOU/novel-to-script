'use client';

import type { GenerationJob } from '@/server/shared/platform/domain';
import type { SupportedLocale } from '@/server/shared/platform/domain';
import {
  formatCounterLabel,
  formatJobStatus,
} from '@/features/saas/project/presentation';

export type PipelineStageStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface PipelineStageItem {
  id: string;
  title: string;
  status: PipelineStageStatus;
  summary?: string | null;
  detail?: string | null;
  jobId?: string | null;
  artifactId?: string | null;
}

interface PipelineProgressBarProps {
  locale: SupportedLocale;
  title: string;
  subtitle?: string;
  stages: PipelineStageItem[];
  jobs?: GenerationJob[];
  emptyLabel?: string;
}

const DEFAULT_EMPTY_LABEL = 'Pipeline summary pending.';

export function PipelineProgressBar({
  locale,
  title,
  subtitle,
  stages,
  jobs,
  emptyLabel,
}: PipelineProgressBarProps) {
  const completedCount = stages.filter((stage) => stage.status === 'succeeded').length;
  const runningCount = stages.filter((stage) => stage.status === 'running').length;
  const failedCount = stages.filter((stage) => stage.status === 'failed').length;
  const totalJobs = jobs?.length ?? 0;

  return (
    <section className="pipeline-progress-panel stack-gap">
      <div className="list-row">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="pipeline-progress-stats">
          <span className="chip">{`${completedCount}/${stages.length}`}</span>
          {runningCount > 0 ? (
            <span className="status-pill status-pill-running">
              {formatCounterLabel(locale, runningCount, 'running stage', 'running stages', '进行中阶段')}
            </span>
          ) : null}
          {failedCount > 0 ? (
            <span className="status-pill status-pill-danger">
              {formatCounterLabel(locale, failedCount, 'failed stage', 'failed stages', '失败阶段')}
            </span>
          ) : null}
          {totalJobs > 0 ? (
            <span className="chip">
              {formatCounterLabel(locale, totalJobs, 'job', 'jobs', '任务')}
            </span>
          ) : null}
        </div>
      </div>

      {stages.length === 0 ? (
        <p className="helper-text">{emptyLabel ?? DEFAULT_EMPTY_LABEL}</p>
      ) : (
        <div className="pipeline-stage-rail" role="list" aria-label={title}>
          {stages.map((stage, index) => {
            const tone = getTone(stage.status);
            return (
              <article
                key={stage.id}
                className={`pipeline-stage-card pipeline-stage-card-${tone}`}
                role="listitem"
                aria-current={stage.status === 'running' ? 'step' : undefined}
              >
                <div className="pipeline-stage-index">{index + 1}</div>
                <div className="stack-gap-sm">
                  <div className="pipeline-stage-headline">
                    <strong>{stage.title}</strong>
                    <span className={`status-pill status-pill-${tone}`}>
                      {formatJobStatus(locale, stage.status)}
                    </span>
                  </div>
                  <p className="pipeline-stage-summary">
                    {stage.summary?.trim() || emptyLabel || DEFAULT_EMPTY_LABEL}
                  </p>
                  {stage.detail ? <p className="pipeline-stage-detail">{stage.detail}</p> : null}
                </div>
                <div className="pipeline-stage-meta">
                  {stage.jobId ? (
                    <span>{locale === 'en-US' ? 'Job' : '任务'} {shortenId(stage.jobId)}</span>
                  ) : null}
                  {stage.artifactId ? (
                    <span>{locale === 'en-US' ? 'Artifact' : '产物'} {shortenId(stage.artifactId)}</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getTone(status: PipelineStageStatus) {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'danger';
    case 'running':
      return 'running';
    case 'cancelled':
      return 'muted';
    case 'queued':
      return 'queued';
    default:
      return 'pending';
  }
}

function shortenId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

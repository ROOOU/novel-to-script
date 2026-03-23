'use client';

import type { GenerationJob } from '@/server/shared/platform/domain';

interface JobTimelinePanelProps {
  title: string;
  jobs: GenerationJob[];
}

export function JobTimelinePanel({ title, jobs }: JobTimelinePanelProps) {
  return (
    <article className="card stack-gap">
      <h2>{title}</h2>
      {jobs.map((job) => (
        <div key={job.id} className="timeline-row">
          <div className="timeline-marker" />
          <div className="timeline-card">
            <div className="list-row">
              <div>
                <strong>{job.kind}</strong>
                <p>{job.currentStep ?? job.status}</p>
              </div>
              <div className="list-row-meta">
                <span>{job.status}</span>
                <span>{job.progress}%</span>
              </div>
            </div>
            {job.errorMessage ? <p className="error-message">{job.errorMessage}</p> : null}
          </div>
        </div>
      ))}
      {jobs.length === 0 ? <p className="helper-text">No jobs yet.</p> : null}
    </article>
  );
}

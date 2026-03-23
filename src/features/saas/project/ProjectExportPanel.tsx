'use client';

import { useMemo, useState } from 'react';
import type { GenerationArtifact } from '@/server/shared/platform/domain';

interface ProjectExportPanelProps {
  projectId: string;
  title: string;
  subtitle: string;
  markdownLabel: string;
  jsonLabel: string;
  textLabel: string;
  latestExportsLabel: string;
  downloadLabel: string;
  exports: GenerationArtifact[];
  onExportCreated?: () => Promise<void> | void;
}

export function ProjectExportPanel({
  projectId,
  title,
  subtitle,
  markdownLabel,
  jsonLabel,
  textLabel,
  latestExportsLabel,
  downloadLabel,
  exports,
  onExportCreated,
}: ProjectExportPanelProps) {
  const [runningFormat, setRunningFormat] = useState<string | null>(null);
  const latestExports = useMemo(
    () => [...exports].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [exports]
  );

  async function handleExport(format: 'markdown' | 'json' | 'text') {
    setRunningFormat(format);
    const response = await fetch(`/api/projects/${projectId}/exports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ format }),
    });
    const payload = await response.json();
    setRunningFormat(null);
    if (!payload.ok) {
      return;
    }

    await onExportCreated?.();
    window.open(payload.downloadUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <article className="card stack-gap">
      <div className="stack-gap-sm">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          disabled={runningFormat !== null}
          onClick={() => handleExport('markdown')}
        >
          {runningFormat === 'markdown' ? `${markdownLabel}...` : markdownLabel}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={runningFormat !== null}
          onClick={() => handleExport('json')}
        >
          {runningFormat === 'json' ? `${jsonLabel}...` : jsonLabel}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={runningFormat !== null}
          onClick={() => handleExport('text')}
        >
          {runningFormat === 'text' ? `${textLabel}...` : textLabel}
        </button>
      </div>

      <div className="stack-gap-sm">
        <h3>{latestExportsLabel}</h3>
        {latestExports.length === 0 ? (
          <p>{subtitle}</p>
        ) : (
          <div className="export-list">
            {latestExports.map((artifact) => (
              <div key={artifact.id} className="export-item">
                <div>
                  <strong>{artifact.title}</strong>
                  <p>
                    {artifact.format} · {new Date(artifact.createdAt).toLocaleString()}
                  </p>
                </div>
                <a className="inline-link" href={`/api/artifacts/${artifact.id}/download`}>
                  {downloadLabel}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

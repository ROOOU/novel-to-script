'use client';

import { useMemo, useState } from 'react';
import type {
  ArtifactRelation,
  GenerationArtifact,
  GenerationJob,
} from '@/server/shared/platform/domain';

interface StoryboardPanelProps {
  title: string;
  subtitle?: string;
  artifacts: GenerationArtifact[];
  artifactRelations?: ArtifactRelation[];
  jobs?: GenerationJob[];
  initialArtifactId?: string | null;
  downloadHrefForArtifact?: (artifact: GenerationArtifact) => string;
  onSelectSourceArtifact?: (artifactId: string) => void;
  labels?: Partial<{
    emptyState: string;
    noSelection: string;
    preview: string;
    download: string;
    sourceChain: string;
    sourceArtifacts: string;
    sourceJob: string;
    sourceFallback: string;
    sourceMetadata: string;
    relationCount: string;
    storyboardVersion: string;
    storyboardJob: string;
    artifactKind: string;
    createdAt: string;
    updatedAt: string;
    contentEmpty: string;
  }>;
}

const DEFAULT_LABELS = {
  emptyState: 'No storyboard artifacts yet.',
  noSelection: 'Select a storyboard artifact to inspect its text, source relation, and download link.',
  preview: 'Storyboard preview',
  download: 'Download',
  sourceChain: 'Source chain',
  sourceArtifacts: 'Source scripts',
  sourceJob: 'Source job',
  sourceFallback: 'Historical artifact: relation data is unavailable.',
  sourceMetadata: 'Source metadata',
  relationCount: 'Relations',
  storyboardVersion: 'Version',
  storyboardJob: 'Story job',
  artifactKind: 'Kind',
  createdAt: 'Created',
  updatedAt: 'Updated',
  contentEmpty: 'No storyboard content available.',
};

export function StoryboardPanel({
  title,
  subtitle,
  artifacts,
  artifactRelations = [],
  jobs = [],
  initialArtifactId,
  downloadHrefForArtifact,
  onSelectSourceArtifact,
  labels,
}: StoryboardPanelProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const storyboardArtifacts = useMemo(
    () =>
      [...artifacts]
        .filter((artifact) => artifact.kind === 'storyboard')
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.version - left.version),
    [artifacts]
  );
  const artifactById = useMemo(() => new Map(artifacts.map((artifact) => [artifact.id, artifact])), [artifacts]);
  const relationsByDownstream = useMemo(() => groupRelationsByDownstream(artifactRelations), [artifactRelations]);
  const [manualSelectedArtifactId, setManualSelectedArtifactId] = useState<string | null>(initialArtifactId ?? null);
  const selectedArtifactId = useMemo(() => {
    if (
      manualSelectedArtifactId &&
      storyboardArtifacts.some((artifact) => artifact.id === manualSelectedArtifactId)
    ) {
      return manualSelectedArtifactId;
    }

    return initialArtifactId ?? storyboardArtifacts[0]?.id ?? null;
  }, [initialArtifactId, manualSelectedArtifactId, storyboardArtifacts]);
  const selectedArtifact = storyboardArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null;
  const selectedJob = selectedArtifact
    ? jobs.find((job) => job.id === selectedArtifact.generationJobId) ?? null
    : null;
  const selectedMetadata = selectedArtifact?.metadata ?? {};
  const sourceRelations = selectedArtifact ? relationsByDownstream.get(selectedArtifact.id) ?? [] : [];
  const selectedSourceArtifactIds = selectedArtifact
    ? uniqueValues([
        ...readSourceArtifactIds(selectedArtifact.metadata),
        ...sourceRelations.map((relation) => relation.upstreamArtifactId),
      ])
    : [];
  const selectedSourceArtifacts = selectedSourceArtifactIds
    .map((artifactId) => artifactById.get(artifactId))
    .filter((artifact): artifact is GenerationArtifact => Boolean(artifact));
  const selectedCharacters = readStringArray(selectedMetadata.characters);
  const selectedScenes = readStringArray(selectedMetadata.scenes);
  return (
    <article className="card stack-gap storyboard-panel">
      <div className="stack-gap-sm">
        <div className="list-row">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <span className="chip">{storyboardArtifacts.length}</span>
        </div>
      </div>

      <div className="artifact-browser-layout storyboard-layout">
        <aside className="artifact-browser-sidebar storyboard-sidebar">
          <div className="stack-gap-sm">
            <strong>{mergedLabels.sourceArtifacts}</strong>
            <p className="helper-text">{mergedLabels.noSelection}</p>
          </div>

          {storyboardArtifacts.length === 0 ? (
            <p className="helper-text">{mergedLabels.emptyState}</p>
          ) : (
            <div className="artifact-browser-list">
              {storyboardArtifacts.map((artifact) => {
                const relationCount = relationsByDownstream.get(artifact.id)?.length ?? 0;
                const statusTone = getJobTone(jobs.find((job) => job.id === artifact.generationJobId)?.status);
                return (
                  <button
                    key={artifact.id}
                    type="button"
                    className={`artifact-browser-item ${
                      selectedArtifact?.id === artifact.id ? 'active' : ''
                    }`}
                    onClick={() => setManualSelectedArtifactId(artifact.id)}
                  >
                    <div className="list-row">
                      <div>
                        <strong>{artifact.title}</strong>
                        <p>{artifact.kind}</p>
                      </div>
                      <span className={`status-pill status-pill-${statusTone}`}>{artifact.version}</span>
                    </div>
                    <div className="artifact-browser-meta">
                      <span>{`${mergedLabels.relationCount}: ${relationCount}`}</span>
                      <span>{new Date(artifact.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="artifact-browser-detail storyboard-detail">
          {selectedArtifact ? (
            <>
              <div className="artifact-detail-header">
                <div>
                  <div className="artifact-detail-topline">
                    <h3>{selectedArtifact.title}</h3>
                    <span className="chip">{selectedArtifact.kind}</span>
                  </div>
                  <p className="helper-text">
                    {mergedLabels.storyboardVersion} {selectedArtifact.version} · {new Date(selectedArtifact.createdAt).toLocaleString()}
                  </p>
                </div>
                <a
                  className="secondary-button"
                  href={downloadHrefForArtifact?.(selectedArtifact) ?? `/api/artifacts/${selectedArtifact.id}/download`}
                >
                  {mergedLabels.download}
                </a>
              </div>

              <div className="artifact-preview-panel">
                <div className="list-row">
                  <strong>{mergedLabels.preview}</strong>
                  <span className={`status-pill status-pill-${getJobTone(selectedJob?.status)}`}>
                    {selectedJob?.status ?? 'pending'}
                  </span>
                </div>
                <pre className="artifact-preview">
                  {selectedArtifact.content?.trim() || mergedLabels.contentEmpty}
                </pre>
              </div>

              <div className="artifact-detail-grid">
                <div className="artifact-meta-card">
                  <span>{mergedLabels.artifactKind}</span>
                  <strong>{selectedArtifact.kind}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{mergedLabels.createdAt}</span>
                  <strong>{new Date(selectedArtifact.createdAt).toLocaleString()}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{mergedLabels.updatedAt}</span>
                  <strong>{new Date(selectedArtifact.updatedAt).toLocaleString()}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{mergedLabels.storyboardJob}</span>
                  <strong>{shortenId(selectedArtifact.generationJobId)}</strong>
                </div>
              </div>

              {selectedCharacters.length > 0 || selectedScenes.length > 0 ? (
                <section className="artifact-source-panel">
                  <div className="list-row">
                    <strong>{mergedLabels.sourceMetadata}</strong>
                    <span className="chip">
                      {Number(selectedCharacters.length > 0) + Number(selectedScenes.length > 0)}
                    </span>
                  </div>

                  {selectedCharacters.length > 0 ? (
                    <div className="artifact-source-summary">
                      <strong>Characters</strong>
                      <p className="helper-text">{selectedCharacters.join(' · ')}</p>
                    </div>
                  ) : null}

                  {selectedScenes.length > 0 ? (
                    <div className="artifact-source-summary">
                      <strong>Scenes</strong>
                      <p className="helper-text">{selectedScenes.join(' · ')}</p>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="artifact-source-panel">
                <div className="list-row">
                  <strong>{mergedLabels.sourceChain}</strong>
                  <span className="chip">{selectedSourceArtifacts.length}</span>
                </div>

                {selectedSourceArtifacts.length === 0 ? (
                  <p className="helper-text">{mergedLabels.sourceFallback}</p>
                ) : (
                  <div className="source-chain-list">
                    {selectedSourceArtifacts.map((artifact) => {
                      const job = jobs.find((entry) => entry.id === artifact.generationJobId);
                      const relation = sourceRelations.find(
                        (entry) => entry.upstreamArtifactId === artifact.id
                      );

                      return (
                        <article key={artifact.id} className="source-chain-card">
                          <div className="list-row">
                            <div>
                              <strong>{artifact.title}</strong>
                              <p>{artifact.kind} · v{artifact.version}</p>
                            </div>
                            <a
                              className="inline-link"
                              href={downloadHrefForArtifact?.(artifact) ?? `/api/artifacts/${artifact.id}/download`}
                            >
                              {mergedLabels.download}
                            </a>
                          </div>
                          <div className="artifact-browser-meta">
                            <span>{new Date(artifact.createdAt).toLocaleString()}</span>
                            <span>{relation?.relationType ?? mergedLabels.sourceMetadata}</span>
                          </div>
                          {artifact.content ? (
                            <p className="source-chain-snippet">{excerpt(artifact.content)}</p>
                          ) : null}
                          <div className="source-chain-actions">
                            {job ? (
                              <div className="source-job-card">
                                <strong>{mergedLabels.sourceJob}</strong>
                                <p>
                                  {job.kind} · {job.status} · {job.currentStep ?? 'idle'}
                                </p>
                                {job.outputSummary ? <p>{job.outputSummary}</p> : null}
                              </div>
                            ) : null}
                            {onSelectSourceArtifact ? (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => onSelectSourceArtifact(artifact.id)}
                              >
                                {artifact.kind === 'script' ? 'Jump to script version' : 'Jump to source version'}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            <p className="helper-text">{mergedLabels.noSelection}</p>
          )}
        </section>
      </div>
    </article>
  );
}

function groupRelationsByDownstream(relations: ArtifactRelation[]) {
  const map = new Map<string, ArtifactRelation[]>();
  for (const relation of relations) {
    const bucket = map.get(relation.downstreamArtifactId) ?? [];
    bucket.push(relation);
    map.set(relation.downstreamArtifactId, bucket);
  }
  return map;
}

function readSourceArtifactIds(metadata?: Record<string, unknown>) {
  const value = metadata?.sourceScriptArtifactIds;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function getJobTone(status?: GenerationJob['status']) {
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

function shortenId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function excerpt(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 180)}…`;
}

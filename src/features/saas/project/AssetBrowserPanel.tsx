'use client';

import { useMemo, useState } from 'react';
import type {
  ArtifactRelation,
  GenerationArtifact,
  GenerationJob,
} from '@/server/shared/platform/domain';

type AssetFilterKind = 'all' | GenerationArtifact['kind'];
type SortOrder = 'latest' | 'oldest';

interface AssetBrowserPanelProps {
  title: string;
  subtitle?: string;
  artifacts: GenerationArtifact[];
  artifactRelations?: ArtifactRelation[];
  jobs?: GenerationJob[];
  initialKind?: AssetFilterKind;
  initialSearch?: string;
  downloadHrefForArtifact?: (artifact: GenerationArtifact) => string;
  labels?: Partial<{
    all: string;
    analysis: string;
    outline: string;
    script: string;
    storyboard: string;
    export: string;
    prompt: string;
    searchPlaceholder: string;
    sortLatest: string;
    sortOldest: string;
    emptyState: string;
    noSelection: string;
    sourceArtifacts: string;
    downstreamArtifacts: string;
    relationSummary: string;
    jobSummary: string;
    download: string;
    contentEmpty: string;
    sourceFallback: string;
  }>;
}

const DEFAULT_LABELS = {
  all: 'All',
  analysis: 'Analysis',
  outline: 'Outline',
  script: 'Script',
  storyboard: 'Storyboard',
  export: 'Export',
  prompt: 'Prompt',
  searchPlaceholder: 'Search by title or content',
  sortLatest: 'Latest',
  sortOldest: 'Oldest',
  emptyState: 'No artifacts match the current filters.',
  noSelection: 'Select an artifact to inspect its content and relation graph.',
  sourceArtifacts: 'Source artifacts',
  downstreamArtifacts: 'Downstream artifacts',
  relationSummary: 'Relation graph',
  jobSummary: 'Job summary',
  download: 'Download',
  contentEmpty: 'No content available.',
  sourceFallback: 'Historical artifact: relation data is unavailable.',
};

const KIND_ORDER: GenerationArtifact['kind'][] = [
  'analysis',
  'outline',
  'script',
  'storyboard',
  'export',
  'prompt',
];

export function AssetBrowserPanel({
  title,
  subtitle,
  artifacts,
  artifactRelations = [],
  jobs = [],
  initialKind = 'all',
  initialSearch = '',
  downloadHrefForArtifact,
  labels,
}: AssetBrowserPanelProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const [kindFilter, setKindFilter] = useState<AssetFilterKind>(initialKind);
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [searchValue, setSearchValue] = useState(initialSearch);
  const [manualSelectedArtifactId, setManualSelectedArtifactId] = useState<string | null>(null);

  const artifactById = useMemo(() => new Map(artifacts.map((artifact) => [artifact.id, artifact])), [artifacts]);
  const relationsByUpstream = useMemo(() => groupRelationsByUpstream(artifactRelations), [artifactRelations]);
  const relationsByDownstream = useMemo(() => groupRelationsByDownstream(artifactRelations), [artifactRelations]);
  const kindLabels: Record<AssetFilterKind, string> = {
    all: mergedLabels.all,
    analysis: mergedLabels.analysis,
    outline: mergedLabels.outline,
    script: mergedLabels.script,
    storyboard: mergedLabels.storyboard,
    export: mergedLabels.export,
    prompt: mergedLabels.prompt,
  };

  const filteredArtifacts = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return [...artifacts]
      .filter((artifact) => kindFilter === 'all' || artifact.kind === kindFilter)
      .filter((artifact) => {
        if (!query) {
          return true;
        }

        return [artifact.title, artifact.content ?? '', artifact.kind, artifact.version.toString()]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        const timeDelta = left.createdAt.localeCompare(right.createdAt);
        return sortOrder === 'latest' ? -timeDelta : timeDelta;
      });
  }, [artifacts, kindFilter, searchValue, sortOrder]);

  const selectedArtifactId = useMemo(() => {
    if (
      manualSelectedArtifactId &&
      filteredArtifacts.some((artifact) => artifact.id === manualSelectedArtifactId)
    ) {
      return manualSelectedArtifactId;
    }

    return filteredArtifacts[0]?.id ?? null;
  }, [filteredArtifacts, manualSelectedArtifactId]);
  const selectedArtifact = filteredArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null;
  const selectedJob = selectedArtifact
    ? jobs.find((job) => job.id === selectedArtifact.generationJobId) ?? null
    : null;
  const selectedUpstreamArtifacts = selectedArtifact
    ? resolveRelatedArtifacts(
        selectedArtifact.id,
        relationsByDownstream,
        artifactById,
        'upstream',
        selectedArtifact.metadata
      )
    : [];
  const selectedDownstreamArtifacts = selectedArtifact
    ? resolveRelatedArtifacts(
        selectedArtifact.id,
        relationsByUpstream,
        artifactById,
        'downstream',
        selectedArtifact.metadata
      )
    : [];

  return (
    <article className="card stack-gap asset-browser-panel">
      <div className="stack-gap-sm">
        <div className="list-row">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <span className="chip">{filteredArtifacts.length}</span>
        </div>
      </div>

      <div className="artifact-browser-toolbar">
        <input
          className="artifact-search"
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder={mergedLabels.searchPlaceholder}
        />
        <div className="artifact-sort-row">
          <button
            type="button"
            className={`segment ${sortOrder === 'latest' ? 'active' : ''}`}
            onClick={() => setSortOrder('latest')}
          >
            {mergedLabels.sortLatest}
          </button>
          <button
            type="button"
            className={`segment ${sortOrder === 'oldest' ? 'active' : ''}`}
            onClick={() => setSortOrder('oldest')}
          >
            {mergedLabels.sortOldest}
          </button>
        </div>
      </div>

      <div className="artifact-filter-bar">
        {['all', ...KIND_ORDER].map((kind) => {
          const count = kind === 'all' ? artifacts.length : artifacts.filter((artifact) => artifact.kind === kind).length;
          const tone = kind === 'all' ? 'neutral' : kind;
          return (
            <button
              key={kind}
              type="button"
              className={`filter-chip ${kindFilter === kind ? 'active' : ''} filter-chip-${tone}`}
              onClick={() => setKindFilter(kind as AssetFilterKind)}
            >
              <span>{kindLabels[kind as AssetFilterKind]}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>

      <div className="artifact-browser-layout">
        <aside className="artifact-browser-sidebar">
          {filteredArtifacts.length === 0 ? (
            <p className="helper-text">{mergedLabels.emptyState}</p>
          ) : (
            <div className="artifact-browser-list">
              {filteredArtifacts.map((artifact) => {
                const job = jobs.find((entry) => entry.id === artifact.generationJobId);
                const statusTone = getJobTone(job?.status);
                return (
                  <button
                    key={artifact.id}
                    type="button"
                    className={`artifact-browser-item ${selectedArtifact?.id === artifact.id ? 'active' : ''}`}
                    onClick={() => setManualSelectedArtifactId(artifact.id)}
                  >
                    <div className="list-row">
                      <div>
                        <strong>{artifact.title}</strong>
                        <p>{artifact.kind} · v{artifact.version}</p>
                      </div>
                      <span className={`status-pill status-pill-${statusTone}`}>{job?.status ?? 'pending'}</span>
                    </div>
                    <div className="artifact-browser-meta">
                      <span>{new Date(artifact.createdAt).toLocaleString()}</span>
                      <span>{artifact.content ? `${artifact.content.length} chars` : 'empty'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="artifact-browser-detail">
          {selectedArtifact ? (
            <>
              <div className="artifact-detail-header">
                <div>
                  <div className="artifact-detail-topline">
                    <h3>{selectedArtifact.title}</h3>
                    <span className="chip">{selectedArtifact.kind}</span>
                  </div>
                  <p className="helper-text">
                    v{selectedArtifact.version} · {new Date(selectedArtifact.createdAt).toLocaleString()}
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
                  <strong>{mergedLabels.relationSummary}</strong>
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
                  <span>{mergedLabels.jobSummary}</span>
                  <strong>{selectedJob ? `${selectedJob.kind} · ${selectedJob.currentStep ?? selectedJob.status}` : '—'}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{mergedLabels.sourceArtifacts}</span>
                  <strong>{selectedUpstreamArtifacts.length}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{mergedLabels.downstreamArtifacts}</span>
                  <strong>{selectedDownstreamArtifacts.length}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>Job ID</span>
                  <strong>{shortenId(selectedArtifact.generationJobId)}</strong>
                </div>
              </div>

              <section className="artifact-source-panel">
                <div className="list-row">
                  <strong>{mergedLabels.sourceArtifacts}</strong>
                  <span className="chip">{selectedUpstreamArtifacts.length}</span>
                </div>

                {selectedUpstreamArtifacts.length === 0 ? (
                  <p className="helper-text">{mergedLabels.sourceFallback}</p>
                ) : (
                  <div className="source-chain-list">
                    {selectedUpstreamArtifacts.map((artifact) => {
                      const job = jobs.find((entry) => entry.id === artifact.generationJobId);
                      const relation = artifactRelations.find(
                        (entry) =>
                          entry.downstreamArtifactId === selectedArtifact.id &&
                          entry.upstreamArtifactId === artifact.id
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
                            <span>{relation?.relationType ?? mergedLabels.sourceFallback}</span>
                          </div>
                          {artifact.content ? <p className="source-chain-snippet">{excerpt(artifact.content)}</p> : null}
                          {job ? (
                            <div className="source-job-card">
                              <strong>{mergedLabels.jobSummary}</strong>
                              <p>
                                {job.kind} · {job.status} · {job.currentStep ?? 'idle'}
                              </p>
                              {job.outputSummary ? <p>{job.outputSummary}</p> : null}
                            </div>
                          ) : null}
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

function groupRelationsByUpstream(relations: ArtifactRelation[]) {
  const map = new Map<string, ArtifactRelation[]>();
  for (const relation of relations) {
    const bucket = map.get(relation.upstreamArtifactId) ?? [];
    bucket.push(relation);
    map.set(relation.upstreamArtifactId, bucket);
  }
  return map;
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

function resolveRelatedArtifacts(
  selectedArtifactId: string,
  relationsMap: Map<string, ArtifactRelation[]>,
  artifactById: Map<string, GenerationArtifact>,
  direction: 'upstream' | 'downstream',
  metadata?: Record<string, unknown>
) {
  const relatedIds = new Set<string>();

  if (direction === 'upstream') {
    const relations = relationsMap.get(selectedArtifactId) ?? [];
    for (const relation of relations) {
      relatedIds.add(relation.upstreamArtifactId);
    }
    for (const id of readSourceArtifactIds(metadata)) {
      relatedIds.add(id);
    }
  } else {
    for (const relation of relationsMap.get(selectedArtifactId) ?? []) {
      relatedIds.add(relation.downstreamArtifactId);
    }
  }

  return [...relatedIds]
    .map((artifactId) => artifactById.get(artifactId))
    .filter((artifact): artifact is GenerationArtifact => Boolean(artifact));
}

function readSourceArtifactIds(metadata?: Record<string, unknown>) {
  const value = metadata?.sourceScriptArtifactIds;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
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

function excerpt(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 180)}…`;
}

function shortenId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

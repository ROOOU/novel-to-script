'use client';

import { useMemo, useState } from 'react';
import type {
  ArtifactRelation,
  GenerationArtifact,
  GenerationJob,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import {
  formatArtifactKind,
  formatJobKind,
  formatJobStatus,
  formatLocaleDateTime,
} from '@/features/saas/project/presentation';
import { deriveArtifactLineage } from '@/features/saas/project/artifact-lineage';

type AssetFilterKind = 'all' | GenerationArtifact['kind'];
type SortOrder = 'latest' | 'oldest';

interface AssetBrowserPanelProps {
  locale: SupportedLocale;
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
    downloadFiltered: string;
    downloading: string;
    contentEmpty: string;
    sourceFallback: string;
    productionChain: string;
  }>;
}

const KIND_ORDER: GenerationArtifact['kind'][] = [
  'analysis',
  'outline',
  'script',
  'storyboard',
  'export',
  'prompt',
];

export function AssetBrowserPanel({
  locale,
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
  const mergedLabels = { ...getDefaultLabels(locale), ...labels };
  const [kindFilter, setKindFilter] = useState<AssetFilterKind>(initialKind);
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [searchValue, setSearchValue] = useState(initialSearch);
  const [manualSelectedArtifactId, setManualSelectedArtifactId] = useState<string | null>(null);
  const [isDownloadingFiltered, setIsDownloadingFiltered] = useState(false);

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
  const selectedLineage = useMemo(
    () =>
      selectedArtifact
        ? deriveArtifactLineage(selectedArtifact, artifacts, artifactRelations)
        : null,
    [artifactRelations, artifacts, selectedArtifact]
  );
  const selectedUpstreamArtifacts = selectedLineage?.directUpstream ?? [];
  const selectedDownstreamArtifacts = selectedLineage?.directDownstream ?? [];
  const productionChain = selectedLineage?.stageCounts ?? [
    { kind: 'analysis' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'analysis').length },
    { kind: 'outline' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'outline').length },
    { kind: 'script' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'script').length },
    { kind: 'storyboard' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'storyboard').length },
  ];
  const chainPreview = selectedLineage?.chainArtifacts
    .map((artifact) => `${formatArtifactKind(locale, artifact.kind)} v${artifact.version}`)
    .join(' → ');

  async function handleDownloadFiltered() {
    if (filteredArtifacts.length === 0 || isDownloadingFiltered) {
      return;
    }

    setIsDownloadingFiltered(true);
    try {
      for (const artifact of filteredArtifacts) {
        const href = downloadHrefForArtifact?.(artifact) ?? `/api/artifacts/${artifact.id}/download`;
        const response = await fetch(href);
        if (!response.ok) {
          throw new Error(`DOWNLOAD_FAILED:${artifact.id}`);
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = resolveDownloadFilename(response, artifact);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(objectUrl);
      }
    } finally {
      setIsDownloadingFiltered(false);
    }
  }

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
        <button
          type="button"
          className="secondary-button"
          disabled={filteredArtifacts.length === 0 || isDownloadingFiltered}
          onClick={() => void handleDownloadFiltered()}
        >
          {isDownloadingFiltered ? mergedLabels.downloading : mergedLabels.downloadFiltered}
        </button>
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

      <section className="artifact-source-panel">
        <div className="list-row">
          <strong>{mergedLabels.productionChain}</strong>
          <span className="chip">{productionChain.reduce((sum, item) => sum + item.count, 0)}</span>
        </div>
        <div className="artifact-filter-bar">
          {productionChain.map((item, index) => (
            <div key={item.kind} className={`filter-chip filter-chip-${item.kind}`}>
              <span>{kindLabels[item.kind]}</span>
              <strong>{item.count}</strong>
              {index < productionChain.length - 1 ? <span aria-hidden="true">→</span> : null}
            </div>
          ))}
        </div>
        {chainPreview ? <p className="helper-text">{chainPreview}</p> : null}
      </section>

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
                        <p>{formatArtifactKind(locale, artifact.kind)} · v{artifact.version}</p>
                      </div>
                      <span className={`status-pill status-pill-${statusTone}`}>
                        {formatJobStatus(locale, job?.status ?? 'pending')}
                      </span>
                    </div>
                    <div className="artifact-browser-meta">
                      <span>{formatLocaleDateTime(locale, artifact.createdAt)}</span>
                      <span>
                        {artifact.content
                          ? locale === 'en-US'
                            ? `${artifact.content.length} chars`
                            : `${artifact.content.length} 字`
                          : locale === 'en-US'
                            ? 'empty'
                            : '空'}
                      </span>
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
                    <span className="chip">{formatArtifactKind(locale, selectedArtifact.kind)}</span>
                  </div>
                  <p className="helper-text">
                    v{selectedArtifact.version} · {formatLocaleDateTime(locale, selectedArtifact.createdAt)}
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
                    {formatJobStatus(locale, selectedJob?.status ?? 'pending')}
                  </span>
                </div>
                <pre className="artifact-preview">
                  {selectedArtifact.content?.trim() || mergedLabels.contentEmpty}
                </pre>
              </div>

              <div className="artifact-detail-grid">
                <div className="artifact-meta-card">
                  <span>{mergedLabels.jobSummary}</span>
                  <strong>
                    {selectedJob
                      ? `${formatJobKind(locale, selectedJob.kind)} · ${selectedJob.currentStep ?? formatJobStatus(locale, selectedJob.status)}`
                      : '—'}
                  </strong>
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
                  <span>{locale === 'en-US' ? 'Job ID' : '任务 ID'}</span>
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
                    {selectedUpstreamArtifacts.map((entry) => {
                      const artifact = entry.artifact;
                      const job = artifact
                        ? jobs.find((jobEntry) => jobEntry.id === artifact.generationJobId)
                        : null;
                      if (!artifact) {
                        return (
                          <article key={entry.artifactId} className="source-chain-card">
                            <div className="list-row">
                              <div>
                                <strong>{shortenId(entry.artifactId)}</strong>
                                <p>{mergedLabels.sourceFallback}</p>
                              </div>
                            </div>
                          </article>
                        );
                      }

                      return (
                        <article key={artifact.id} className="source-chain-card">
                          <div className="list-row">
                            <div>
                              <strong>{artifact.title}</strong>
                              <p>{formatArtifactKind(locale, artifact.kind)} · v{artifact.version}</p>
                            </div>
                            <a
                              className="inline-link"
                              href={downloadHrefForArtifact?.(artifact) ?? `/api/artifacts/${artifact.id}/download`}
                            >
                              {mergedLabels.download}
                            </a>
                          </div>
                          <div className="artifact-browser-meta">
                            <span>{formatLocaleDateTime(locale, artifact.createdAt)}</span>
                            <span>{entry.relationType === 'metadata' ? mergedLabels.sourceFallback : entry.relationType}</span>
                          </div>
                          {artifact.content ? <p className="source-chain-snippet">{excerpt(artifact.content)}</p> : null}
                          {job ? (
                            <div className="source-job-card">
                              <strong>{mergedLabels.jobSummary}</strong>
                              <p>
                                {formatJobKind(locale, job.kind)} · {formatJobStatus(locale, job.status)} · {job.currentStep ?? 'idle'}
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

              <section className="artifact-source-panel">
                <div className="list-row">
                  <strong>{mergedLabels.downstreamArtifacts}</strong>
                  <span className="chip">{selectedDownstreamArtifacts.length}</span>
                </div>

                {selectedDownstreamArtifacts.length === 0 ? (
                  <p className="helper-text">{mergedLabels.sourceFallback}</p>
                ) : (
                  <div className="source-chain-list">
                    {selectedDownstreamArtifacts.map((entry) => {
                      const artifact = entry.artifact;
                      const job = artifact
                        ? jobs.find((jobEntry) => jobEntry.id === artifact.generationJobId)
                        : null;
                      if (!artifact) {
                        return (
                          <article key={entry.artifactId} className="source-chain-card">
                            <div className="list-row">
                              <div>
                                <strong>{shortenId(entry.artifactId)}</strong>
                                <p>{mergedLabels.sourceFallback}</p>
                              </div>
                            </div>
                          </article>
                        );
                      }

                      return (
                        <article key={artifact.id} className="source-chain-card">
                          <div className="list-row">
                            <div>
                              <strong>{artifact.title}</strong>
                              <p>{formatArtifactKind(locale, artifact.kind)} · v{artifact.version}</p>
                            </div>
                            <a
                              className="inline-link"
                              href={downloadHrefForArtifact?.(artifact) ?? `/api/artifacts/${artifact.id}/download`}
                            >
                              {mergedLabels.download}
                            </a>
                          </div>
                          <div className="artifact-browser-meta">
                            <span>{formatLocaleDateTime(locale, artifact.createdAt)}</span>
                            <span>{entry.relationType}</span>
                          </div>
                          {artifact.content ? <p className="source-chain-snippet">{excerpt(artifact.content)}</p> : null}
                          {job ? (
                            <div className="source-job-card">
                              <strong>{mergedLabels.jobSummary}</strong>
                              <p>
                                {formatJobKind(locale, job.kind)} · {formatJobStatus(locale, job.status)} · {job.currentStep ?? 'idle'}
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

function getDefaultLabels(locale: SupportedLocale) {
  if (locale === 'en-US') {
    return {
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
      downloadFiltered: 'Download filtered',
      downloading: 'Downloading...',
      contentEmpty: 'No content available.',
      sourceFallback: 'No linked artifacts available.',
      productionChain: 'Production chain',
    };
  }

  return {
    all: '全部',
    analysis: '分析',
    outline: '大纲',
    script: '剧本',
    storyboard: '分镜',
    export: '导出',
    prompt: '提示词',
    searchPlaceholder: '按标题或内容搜索',
    sortLatest: '最新优先',
    sortOldest: '最早优先',
    emptyState: '当前筛选条件下没有匹配产物。',
    noSelection: '选择一个产物后，可以查看内容和依赖关系。',
    sourceArtifacts: '上游产物',
    downstreamArtifacts: '下游产物',
    relationSummary: '依赖关系',
    jobSummary: '任务摘要',
    download: '下载',
    downloadFiltered: '批量下载当前筛选结果',
    downloading: '下载中...',
    contentEmpty: '当前没有可展示内容。',
    sourceFallback: '暂无可展示的关联产物。',
    productionChain: '生产链路',
  };
}

function resolveDownloadFilename(
  response: Response,
  artifact: GenerationArtifact
) {
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/i);
  if (match?.[1]) {
    return match[1];
  }

  const sanitizedTitle = artifact.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'artifact';

  return `${sanitizedTitle}.${extensionForFormat(artifact.format)}`;
}

function extensionForFormat(format: GenerationArtifact['format']) {
  switch (format) {
    case 'application/json':
      return 'json';
    case 'text/csv':
      return 'csv';
    case 'text/markdown':
      return 'md';
    case 'application/pdf':
      return 'pdf';
    case 'application/zip':
      return 'zip';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'text/plain':
    default:
      return 'txt';
  }
}

'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { WorkspaceListRow, WorkspaceStatusPill } from '@/components/WorkspaceUI';
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
import {
  formatAnalysisStrategyLabel,
  formatExecutionBehaviorSummary,
  formatExecutionModeLabel,
  formatOutlineStrategyLabel,
  formatScriptStrategyLabel,
  readMergedScriptDiagnostics,
} from '@/features/saas/project/job-diagnostics';

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
    story_bible: string;
    scene_cards: string;
    outline: string;
    script: string;
    storyboard: string;
    shot_plan: string;
    prompt_pack: string;
    reference_image: string;
    video_clip: string;
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
    executionDiagnostics: string;
    diagnosticsExecutionMode: string;
    diagnosticsChunkCount: string;
    diagnosticsAnalyzedChunks: string;
    diagnosticsOutlinedChunks: string;
    diagnosticsAnalysisStrategy: string;
    diagnosticsOutlineStrategy: string;
    diagnosticsScriptStrategy: string;
    diagnosticsSourceChunk: string;
    diagnosticsComplexity: string;
  }>;
}

const KIND_ORDER: GenerationArtifact['kind'][] = [
  'analysis',
  'story_bible',
  'scene_cards',
  'outline',
  'script',
  'storyboard',
  'shot_plan',
  'prompt_pack',
  'reference_image',
  'video_clip',
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
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false);

  const kindLabels: Record<AssetFilterKind, string> = {
    all: mergedLabels.all,
    analysis: mergedLabels.analysis,
    story_bible: mergedLabels.story_bible,
    scene_cards: mergedLabels.scene_cards,
    outline: mergedLabels.outline,
    script: mergedLabels.script,
    storyboard: mergedLabels.storyboard,
    shot_plan: mergedLabels.shot_plan,
    prompt_pack: mergedLabels.prompt_pack,
    reference_image: mergedLabels.reference_image,
    video_clip: mergedLabels.video_clip,
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
  const selectedUpstreamArtifacts = useMemo(
    () => selectedLineage?.directUpstream ?? [],
    [selectedLineage]
  );
  const selectedDownstreamArtifacts = useMemo(
    () => selectedLineage?.directDownstream ?? [],
    [selectedLineage]
  );
  const selectedLineageUpstreamArtifacts = useMemo(
    () => selectedLineage?.upstream ?? [],
    [selectedLineage]
  );
  const selectedScriptDiagnostics = useMemo(() => {
    if (!selectedArtifact) {
      return null;
    }

    const upstreamArtifacts = [
      ...selectedUpstreamArtifacts,
      ...selectedLineageUpstreamArtifacts,
    ]
      .map((entry) => entry.artifact)
      .filter((artifact): artifact is GenerationArtifact => Boolean(artifact));

    const diagnosticsArtifacts = dedupeArtifactsById([
      selectedArtifact,
      ...upstreamArtifacts,
    ]).filter((artifact) =>
      artifact.kind === 'analysis' || artifact.kind === 'outline' || artifact.kind === 'script'
    );

    return readMergedScriptDiagnostics(diagnosticsArtifacts.map((artifact) => artifact.metadata));
  }, [selectedArtifact, selectedLineageUpstreamArtifacts, selectedUpstreamArtifacts]);
  const productionChain = selectedLineage?.stageCounts ?? [
    { kind: 'analysis' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'analysis').length },
    { kind: 'story_bible' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'story_bible').length },
    { kind: 'scene_cards' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'scene_cards').length },
    { kind: 'outline' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'outline').length },
    { kind: 'script' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'script').length },
    { kind: 'storyboard' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'storyboard').length },
    { kind: 'shot_plan' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'shot_plan').length },
    { kind: 'prompt_pack' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'prompt_pack').length },
    { kind: 'reference_image' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'reference_image').length },
    { kind: 'video_clip' as const, artifacts: [], count: artifacts.filter((artifact) => artifact.kind === 'video_clip').length },
  ];
  const chainPreview = selectedLineage?.chainArtifacts
    .map((artifact) => `${formatArtifactKind(locale, artifact.kind)} v${artifact.version}`)
    .join(' → ');
  const selectedPreview = useMemo(
    () => (selectedArtifact ? buildArtifactPreviewModel(selectedArtifact, locale) : null),
    [locale, selectedArtifact]
  );

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
        <WorkspaceListRow>
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <span className="chip">{filteredArtifacts.length}</span>
        </WorkspaceListRow>
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
        <WorkspaceListRow>
          <strong>{mergedLabels.productionChain}</strong>
          <span className="chip">{productionChain.reduce((sum, item) => sum + item.count, 0)}</span>
        </WorkspaceListRow>
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
                    <WorkspaceListRow>
                      <div>
                        <strong>{artifact.title}</strong>
                        <p>{formatArtifactKind(locale, artifact.kind)} · v{artifact.version}</p>
                      </div>
                      <WorkspaceStatusPill tone={statusTone}>
                        {formatJobStatus(locale, job?.status ?? 'pending')}
                      </WorkspaceStatusPill>
                    </WorkspaceListRow>
                    <div className="artifact-browser-meta">
                      <span>{formatLocaleDateTime(locale, artifact.createdAt)}</span>
                      <span>{formatArtifactMetric(locale, artifact)}</span>
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
                <WorkspaceListRow>
                  <strong>{mergedLabels.relationSummary}</strong>
                  <WorkspaceStatusPill tone={getJobTone(selectedJob?.status)}>
                    {formatJobStatus(locale, selectedJob?.status ?? 'pending')}
                  </WorkspaceStatusPill>
                </WorkspaceListRow>
                {isImageArtifact(selectedArtifact) ? (
                  <div className="stack-gap-sm">
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: 'min(70vh, 30rem)',
                        borderRadius: '1rem',
                        overflow: 'hidden',
                        background: 'rgba(15, 23, 42, 0.06)',
                      }}
                    >
                      <Image
                        src={
                          downloadHrefForArtifact?.(selectedArtifact) ??
                          `/api/artifacts/${selectedArtifact.id}/download`
                        }
                        alt={selectedArtifact.title}
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 50vw"
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                    <p className="helper-text">{formatArtifactMetric(locale, selectedArtifact)}</p>
                  </div>
                ) : isVideoArtifact(selectedArtifact) ? (
                  <div className="stack-gap-sm">
                    <video
                      controls
                      preload="metadata"
                      src={downloadHrefForArtifact?.(selectedArtifact) ?? `/api/artifacts/${selectedArtifact.id}/download`}
                      style={{ width: '100%', borderRadius: '1rem', background: 'rgba(15, 23, 42, 0.85)' }}
                    />
                    <p className="helper-text">{formatArtifactMetric(locale, selectedArtifact)}</p>
                  </div>
                ) : selectedPreview ? (
                  <>
                    <div className="artifact-reading-strip">
                      {selectedPreview.stats.map((stat) => (
                        <div key={stat.label} className="artifact-reading-stat">
                          <span>{stat.label}</span>
                          <strong>{stat.value}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="artifact-reader-layout">
                      {selectedPreview.mode === 'reader' && selectedPreview.sections.length > 1 ? (
                        <nav className="artifact-reader-outline" aria-label="Artifact outline">
                          <div className="artifact-reader-outline-toolbar">
                            <p className="artifact-reader-outline-label">
                              {locale === 'en-US' ? 'Quick navigation' : '快速导航'}
                            </p>
                            <div className="artifact-reader-outline-actions">
                              <button
                                type="button"
                                className="artifact-reader-outline-button"
                                onClick={() => setIsOutlineCollapsed((current) => !current)}
                              >
                                {isOutlineCollapsed
                                  ? locale === 'en-US'
                                    ? 'Show'
                                    : '展开'
                                  : locale === 'en-US'
                                    ? 'Hide'
                                    : '收起'}
                              </button>
                              <a
                                className="artifact-reader-outline-button"
                                href={`#${selectedPreview.sections[0]?.id ?? ''}`}
                              >
                                {locale === 'en-US' ? 'Start' : '开头'}
                              </a>
                              <a
                                className="artifact-reader-outline-button"
                                href={`#${selectedPreview.sections[selectedPreview.sections.length - 1]?.id ?? ''}`}
                              >
                                {locale === 'en-US' ? 'Latest' : '最新段'}
                              </a>
                            </div>
                          </div>
                          {!isOutlineCollapsed ? (
                            <div className="artifact-reader-outline-list">
                              {selectedPreview.sections.map((section) => (
                                <a key={section.id} className="artifact-reader-outline-link" href={`#${section.id}`}>
                                  <span>{section.title}</span>
                                  <small>{section.meta}</small>
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </nav>
                      ) : null}

                      <div className="artifact-reader-body">
                        {selectedPreview.mode === 'reader' ? (
                          <article className="artifact-reader-article">
                            {selectedPreview.sections.map((section) => (
                              <section key={section.id} id={section.id} className="artifact-reader-section">
                                <div className="artifact-reader-section-head">
                                  <h4>{section.title}</h4>
                                  <span>{section.meta}</span>
                                </div>
                                <div className="artifact-reader-section-body">
                                  {section.paragraphs.map((paragraph, index) => (
                                    <div
                                      key={`${section.id}-${index}`}
                                      className={`artifact-reader-line artifact-reader-line-${classifyArtifactLine(
                                        paragraph
                                      )}`}
                                    >
                                      {renderArtifactParagraph(paragraph)}
                                    </div>
                                  ))}
                                </div>
                              </section>
                            ))}
                          </article>
                        ) : (
                          <pre className="artifact-preview artifact-preview-code">
                            {selectedArtifact.content?.trim() || mergedLabels.contentEmpty}
                          </pre>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <pre className="artifact-preview">
                    {selectedArtifact.content?.trim() || mergedLabels.contentEmpty}
                  </pre>
                )}
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

              {selectedScriptDiagnostics ? (
                <section className="artifact-source-panel">
                  <WorkspaceListRow>
                    <strong>{mergedLabels.executionDiagnostics}</strong>
                    <WorkspaceStatusPill
                      tone={selectedScriptDiagnostics.executionMode === 'segmented' ? 'running' : 'success'}
                    >
                      {formatExecutionModeLabel(locale, selectedScriptDiagnostics.executionMode)}
                    </WorkspaceStatusPill>
                  </WorkspaceListRow>
                  <p className="helper-text">
                    {formatExecutionBehaviorSummary(locale, selectedScriptDiagnostics)}
                  </p>
                  <p className="helper-text">
                    {[
                      `${mergedLabels.diagnosticsExecutionMode} ${formatExecutionModeLabel(locale, selectedScriptDiagnostics.executionMode)}`,
                      `${mergedLabels.diagnosticsChunkCount} ${selectedScriptDiagnostics.chunkCount}`,
                      selectedScriptDiagnostics.analyzedChunkCount > 0
                        ? `${mergedLabels.diagnosticsAnalyzedChunks} ${selectedScriptDiagnostics.analyzedChunkCount}`
                        : null,
                      selectedScriptDiagnostics.outlinedChunkCount > 0
                        ? `${mergedLabels.diagnosticsOutlinedChunks} ${selectedScriptDiagnostics.outlinedChunkCount}`
                        : null,
                      selectedScriptDiagnostics.analysisStrategy
                        ? `${mergedLabels.diagnosticsAnalysisStrategy} ${formatAnalysisStrategyLabel(locale, selectedScriptDiagnostics.analysisStrategy)}`
                        : null,
                      selectedScriptDiagnostics.outlineStrategy
                        ? `${mergedLabels.diagnosticsOutlineStrategy} ${formatOutlineStrategyLabel(locale, selectedScriptDiagnostics.outlineStrategy)}`
                        : null,
                      selectedScriptDiagnostics.scriptStrategy
                        ? `${mergedLabels.diagnosticsScriptStrategy} ${formatScriptStrategyLabel(locale, selectedScriptDiagnostics.scriptStrategy)}`
                        : null,
                      selectedScriptDiagnostics.sourceChunkIndex !== null
                        ? `${mergedLabels.diagnosticsSourceChunk} ${selectedScriptDiagnostics.sourceChunkIndex}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </section>
              ) : null}

              <section className="artifact-source-panel">
                <WorkspaceListRow>
                  <strong>{mergedLabels.sourceArtifacts}</strong>
                  <span className="chip">{selectedUpstreamArtifacts.length}</span>
                </WorkspaceListRow>

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
                            <WorkspaceListRow>
                              <div>
                                <strong>{shortenId(entry.artifactId)}</strong>
                                <p>{mergedLabels.sourceFallback}</p>
                              </div>
                            </WorkspaceListRow>
                          </article>
                        );
                      }

                      return (
                        <article key={artifact.id} className="source-chain-card">
                          <WorkspaceListRow>
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
                          </WorkspaceListRow>
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
                <WorkspaceListRow>
                  <strong>{mergedLabels.downstreamArtifacts}</strong>
                  <span className="chip">{selectedDownstreamArtifacts.length}</span>
                </WorkspaceListRow>

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
                            <WorkspaceListRow>
                              <div>
                                <strong>{shortenId(entry.artifactId)}</strong>
                                <p>{mergedLabels.sourceFallback}</p>
                              </div>
                            </WorkspaceListRow>
                          </article>
                        );
                      }

                      return (
                        <article key={artifact.id} className="source-chain-card">
                          <WorkspaceListRow>
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
                          </WorkspaceListRow>
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

function dedupeArtifactsById(artifacts: GenerationArtifact[]) {
  return Array.from(new Map(artifacts.map((artifact) => [artifact.id, artifact])).values());
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

interface ArtifactPreviewModel {
  mode: 'reader' | 'code';
  stats: Array<{ label: string; value: string }>;
  sections: Array<{
    id: string;
    title: string;
    meta: string;
    paragraphs: string[];
  }>;
}

function buildArtifactPreviewModel(
  artifact: GenerationArtifact,
  locale: SupportedLocale
): ArtifactPreviewModel | null {
  const content = artifact.content?.trim();
  if (!content) {
    return null;
  }

  const paragraphBlocks = splitArtifactContentIntoBlocks(content);
  const totalLines = content.split('\n').filter((line) => line.trim().length > 0).length;
  const stats = [
    {
      label: locale === 'en-US' ? 'Length' : '字数',
      value: locale === 'en-US' ? `${content.length} chars` : `${content.length} 字`,
    },
    {
      label: locale === 'en-US' ? 'Blocks' : '段落',
      value: String(paragraphBlocks.length),
    },
    {
      label: locale === 'en-US' ? 'Read' : '阅读',
      value:
        locale === 'en-US'
          ? `${Math.max(1, Math.round(content.length / 900))} min`
          : `${Math.max(1, Math.round(content.length / 450))} 分钟`,
    },
  ];

  if (artifact.format === 'application/json' || artifact.kind === 'shot_plan' || artifact.kind === 'prompt_pack') {
    return {
      mode: 'code',
      stats: [
        ...stats,
        {
          label: locale === 'en-US' ? 'Lines' : '行数',
          value: String(totalLines),
        },
      ],
      sections: [],
    };
  }

  const sections = paragraphBlocks.map((block, index) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const firstLine = lines[0] ?? '';
    const isHeadingLike = /^(第.+集|场景[:：]|分镜[①②③④⑤⑥⑦⑧⑨⑩\d]+|人物[:：]|#)/.test(firstLine);
    const title = isHeadingLike
      ? firstLine
      : artifact.kind === 'script'
        ? locale === 'en-US'
          ? `Script block ${index + 1}`
          : `剧本片段 ${index + 1}`
        : locale === 'en-US'
          ? `Section ${index + 1}`
          : `段落 ${index + 1}`;
    const bodyLines = isHeadingLike ? lines.slice(1) : lines;
    const paragraphs = (bodyLines.length > 0 ? bodyLines : [block]).map((line) => line.trim()).filter(Boolean);

    return {
      id: `artifact-section-${index + 1}`,
      title,
      meta:
        locale === 'en-US'
          ? `${paragraphs.length} lines`
          : `${paragraphs.length} 行`,
      paragraphs,
    };
  });

  return {
    mode: 'reader',
    stats: [
      ...stats,
      {
        label: locale === 'en-US' ? 'Sections' : '章节',
        value: String(sections.length),
      },
    ],
    sections,
  };
}

function isImageArtifact(artifact: GenerationArtifact) {
  return artifact.format.startsWith('image/');
}

function isVideoArtifact(artifact: GenerationArtifact) {
  return artifact.format.startsWith('video/');
}

function formatArtifactMetric(locale: SupportedLocale, artifact: GenerationArtifact) {
  const byteSize =
    typeof artifact.metadata?.byteSize === 'number' && Number.isFinite(artifact.metadata.byteSize)
      ? artifact.metadata.byteSize
      : null;
  if (byteSize !== null) {
    return formatByteSize(locale, byteSize);
  }

  if (artifact.content) {
    return locale === 'en-US' ? `${artifact.content.length} chars` : `${artifact.content.length} 字`;
  }

  return locale === 'en-US' ? 'empty' : '空';
}

function formatByteSize(locale: SupportedLocale, bytes: number) {
  if (bytes < 1024) {
    return locale === 'en-US' ? `${bytes} B` : `${bytes} 字节`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function splitArtifactContentIntoBlocks(content: string): string[] {
  const lines = content
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''));

  const blocks: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const block = buffer.join('\n').trim();
    if (block) {
      blocks.push(block);
    }
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    if (buffer.length > 0 && isArtifactHeadingLine(trimmed)) {
      flush();
    }

    buffer.push(trimmed);
  }

  flush();
  return blocks;
}

function isArtifactHeadingLine(line: string): boolean {
  return /^(第.+集|场景[:：]|分镜[①②③④⑤⑥⑦⑧⑨⑩\d]+|镜头\d+|人物[:：]|#|INT\.|EXT\.)/.test(line);
}

function classifyArtifactLine(line: string) {
  if (/^(第.+集|场景[:：]|分镜[①②③④⑤⑥⑦⑧⑨⑩\d]+|镜头\d+|INT\.|EXT\.)/.test(line)) {
    return 'heading';
  }

  if (/^[^：:\s]{1,8}[：:]/.test(line)) {
    return 'dialogue';
  }

  if (/^[（(【[]/.test(line) || /(转场|切至|镜头|运镜|特写|中景|近景)/.test(line)) {
    return 'stage';
  }

  return 'body';
}

function renderArtifactParagraph(paragraph: string) {
  const dialogueMatch = paragraph.match(/^([^：:\s]{1,8})[：:]\s*(.+)$/);
  if (dialogueMatch) {
    return (
      <>
        <span className="artifact-inline-speaker">{dialogueMatch[1]}</span>
        <span className="artifact-inline-dialogue">{dialogueMatch[2]}</span>
      </>
    );
  }

  return paragraph;
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
      story_bible: 'Story Bible',
      scene_cards: 'Scene Cards',
      outline: 'Outline',
      script: 'Script',
      storyboard: 'Storyboard',
      shot_plan: 'Shot Plan',
      prompt_pack: 'Prompt Pack',
      reference_image: 'Reference Image',
      video_clip: 'Video Clip',
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
      executionDiagnostics: 'Execution diagnostics',
      diagnosticsExecutionMode: 'Execution',
      diagnosticsChunkCount: 'Chunks',
      diagnosticsAnalyzedChunks: 'Analyzed chunks',
      diagnosticsOutlinedChunks: 'Outlined chunks',
      diagnosticsAnalysisStrategy: 'Analysis',
      diagnosticsOutlineStrategy: 'Outline',
      diagnosticsScriptStrategy: 'Script',
      diagnosticsSourceChunk: 'Source chunk',
      diagnosticsComplexity: 'Complexity',
    };
  }

  return {
    all: '全部',
    analysis: '分析',
    story_bible: '故事圣经',
    scene_cards: '场景卡',
    outline: '大纲',
    script: '剧本',
    storyboard: '分镜',
    shot_plan: '镜头计划',
    prompt_pack: '提示词包',
    reference_image: '参考图',
    video_clip: '视频片段',
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
    executionDiagnostics: '执行诊断',
    diagnosticsExecutionMode: '执行模式',
    diagnosticsChunkCount: '分段数量',
    diagnosticsAnalyzedChunks: '分析分段',
    diagnosticsOutlinedChunks: '大纲分段',
    diagnosticsAnalysisStrategy: '分析策略',
    diagnosticsOutlineStrategy: '大纲策略',
    diagnosticsScriptStrategy: '剧本策略',
    diagnosticsSourceChunk: '来源分段',
    diagnosticsComplexity: '复杂度',
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

'use client';

import { useMemo, useState } from 'react';
import type {
  ArtifactRelation,
  GenerationArtifact,
  GenerationJob,
  StoryboardShot,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import {
  formatArtifactKind,
  formatJobKind,
  formatJobStatus,
  formatLocaleDateTime,
} from '@/features/saas/project/presentation';
import { deriveArtifactLineage } from '@/features/saas/project/artifact-lineage';

interface StoryboardPanelProps {
  locale: SupportedLocale;
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
    storyboardVersions: string;
    storyboardJob: string;
    artifactKind: string;
    createdAt: string;
    updatedAt: string;
    contentEmpty: string;
    characters: string;
    scenes: string;
    textView: string;
    shotView: string;
    shotsEmpty: string;
    shotSceneId: string;
    shotId: string;
    shotType: string;
    shotCamera: string;
    shotComposition: string;
    shotMotion: string;
    shotSubject: string;
    shotEnvironment: string;
    shotLighting: string;
    shotAudioHint: string;
    shotVideoPrompt: string;
    valueNotProvided: string;
    jumpToScript: string;
    jumpToSource: string;
    diagnostics: string;
    diagnosticsSummary: string;
    diagnosticsFallbackMode: string;
    diagnosticsStructured: string;
    diagnosticsTextDerived: string;
    diagnosticsPartialTextDerived: string;
    diagnosticsShotCount: string;
    diagnosticsInvalidShots: string;
    diagnosticsParseError: string;
    diagnosticsHealthy: string;
  }>;
}

export function StoryboardPanel({
  locale,
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
  const mergedLabels = { ...getDefaultLabels(locale), ...labels };
  const [previewMode, setPreviewMode] = useState<'text' | 'shots'>('text');
  const storyboardArtifacts = useMemo(
    () =>
      [...artifacts]
        .filter((artifact) => artifact.kind === 'storyboard')
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.version - left.version),
    [artifacts]
  );
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
  const selectedLineage = useMemo(
    () => {
      if (!selectedArtifactId) {
        return null;
      }

      const artifact = artifacts.find((entry) => entry.id === selectedArtifactId);
      return artifact ? deriveArtifactLineage(artifact, artifacts, artifactRelations) : null;
    },
    [artifactRelations, artifacts, selectedArtifactId]
  );
  const storyboardRelationCounts = useMemo(
    () =>
      new Map(
        storyboardArtifacts.map((artifact) => [
          artifact.id,
          deriveArtifactLineage(artifact, artifacts, artifactRelations).upstream.length,
        ])
      ),
    [artifactRelations, artifacts, storyboardArtifacts]
  );
  const selectedSourceArtifacts = selectedLineage?.upstream ?? [];
  const selectedCharacters = readStringArray(selectedMetadata.characters);
  const selectedScenes = readStringArray(selectedMetadata.scenes);
  const selectedShots = readStoryboardShots(selectedMetadata.shots);
  const selectedShotCount = readOptionalNumber(selectedMetadata.shotCount);
  const selectedParseFallbackMode = readParseFallbackMode(selectedMetadata.parseFallbackMode);
  const selectedInvalidShotIndexes = readNumberArray(selectedMetadata.invalidShotIndexes);
  const selectedInvalidShotErrors = readStringArray(selectedMetadata.invalidShotErrors);
  const selectedParseError = readOptionalString(selectedMetadata.parseError);
  const canShowShotView = Array.isArray(selectedMetadata.shots);
  const activePreviewMode = canShowShotView ? previewMode : 'text';
  const chainPreview = selectedLineage?.chainArtifacts
    .map((artifact) => `${formatArtifactKind(locale, artifact.kind)} v${artifact.version}`)
    .join(' → ');
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
            <strong>{mergedLabels.storyboardVersions}</strong>
            <p className="helper-text">{mergedLabels.noSelection}</p>
          </div>

          {storyboardArtifacts.length === 0 ? (
            <p className="helper-text">{mergedLabels.emptyState}</p>
          ) : (
            <div className="artifact-browser-list">
              {storyboardArtifacts.map((artifact) => {
                const relationCount =
                  storyboardRelationCounts.get(artifact.id) ??
                  relationsByDownstream.get(artifact.id)?.length ??
                  0;
                const statusTone = getJobTone(jobs.find((job) => job.id === artifact.generationJobId)?.status);
                return (
                  <button
                    key={artifact.id}
                    type="button"
                    className={`artifact-browser-item ${
                      selectedArtifact?.id === artifact.id ? 'active' : ''
                    }`}
                    onClick={() => {
                      setManualSelectedArtifactId(artifact.id);
                      setPreviewMode('text');
                    }}
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
                      <span>{formatLocaleDateTime(locale, artifact.createdAt)}</span>
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
                    <span className="chip">{formatArtifactKind(locale, selectedArtifact.kind)}</span>
                  </div>
                  <p className="helper-text">
                    {mergedLabels.storyboardVersion} {selectedArtifact.version} · {formatLocaleDateTime(locale, selectedArtifact.createdAt)}
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
                <div className="stack-gap-sm">
                  <div className="list-row">
                    <strong>{mergedLabels.preview}</strong>
                    <span className={`status-pill status-pill-${getJobTone(selectedJob?.status)}`}>
                      {formatJobStatus(locale, selectedJob?.status ?? 'pending')}
                    </span>
                  </div>
                  {canShowShotView ? (
                    <section className="segmented-control" aria-label={mergedLabels.preview}>
                      <button
                        type="button"
                        className={`segment ${activePreviewMode === 'text' ? 'active' : ''}`}
                        onClick={() => setPreviewMode('text')}
                      >
                        {mergedLabels.textView}
                      </button>
                      <button
                        type="button"
                        className={`segment ${activePreviewMode === 'shots' ? 'active' : ''}`}
                        onClick={() => setPreviewMode('shots')}
                      >
                        {mergedLabels.shotView}
                      </button>
                    </section>
                  ) : null}
                </div>

                {activePreviewMode === 'shots' ? (
                  selectedShots.length > 0 ? (
                    <div className="source-chain-list">
                      {selectedShots.map((shot, index) => (
                        <article
                          key={`${shot.sceneId}-${shot.shotId}-${index}`}
                          className="source-chain-card"
                        >
                          <div className="list-row">
                            <div>
                              <strong>{shot.shotId || `${mergedLabels.shotView} ${index + 1}`}</strong>
                              <p>{shot.shotType || mergedLabels.valueNotProvided}</p>
                            </div>
                            <span className="chip">{shot.sceneId || mergedLabels.valueNotProvided}</span>
                          </div>

                          <div className="artifact-detail-grid">
                            {[
                              { label: mergedLabels.shotSceneId, value: shot.sceneId },
                              { label: mergedLabels.shotId, value: shot.shotId },
                              { label: mergedLabels.shotType, value: shot.shotType },
                              { label: mergedLabels.shotCamera, value: shot.camera },
                              { label: mergedLabels.shotComposition, value: shot.composition },
                              { label: mergedLabels.shotMotion, value: shot.motion },
                              { label: mergedLabels.shotSubject, value: shot.subject },
                              { label: mergedLabels.shotEnvironment, value: shot.environment },
                              { label: mergedLabels.shotLighting, value: shot.lighting },
                              { label: mergedLabels.shotAudioHint, value: shot.audioHint },
                            ].map((field) => (
                              <div
                                key={`${shot.sceneId}-${shot.shotId}-${field.label}`}
                                className="artifact-meta-card"
                              >
                                <span>{field.label}</span>
                                <strong>{field.value || mergedLabels.valueNotProvided}</strong>
                              </div>
                            ))}
                          </div>

                          <div className="source-job-card">
                            <strong>{mergedLabels.shotVideoPrompt}</strong>
                            <p className="source-chain-snippet">
                              {shot.videoPrompt || mergedLabels.valueNotProvided}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="helper-text">{mergedLabels.shotsEmpty}</p>
                  )
                ) : (
                  <pre className="artifact-preview">
                    {selectedArtifact.content?.trim() || mergedLabels.contentEmpty}
                  </pre>
                )}
              </div>

              <section className="artifact-source-panel">
                <div className="list-row">
                  <strong>{mergedLabels.diagnostics}</strong>
                  <span
                    className={`status-pill status-pill-${
                      selectedParseError || selectedInvalidShotIndexes.length > 0
                        ? 'danger'
                        : selectedParseFallbackMode
                          ? 'running'
                          : 'success'
                    }`}
                  >
                    {selectedParseFallbackMode
                      ? formatFallbackModeLabel(mergedLabels, selectedParseFallbackMode)
                      : mergedLabels.diagnosticsStructured}
                  </span>
                </div>
                <p className="helper-text">
                  {selectedParseFallbackMode
                    ? mergedLabels.diagnosticsSummary
                    : mergedLabels.diagnosticsHealthy}
                </p>
                <div className="artifact-detail-grid">
                  <div className="artifact-meta-card">
                    <span>{mergedLabels.diagnosticsFallbackMode}</span>
                    <strong>
                      {selectedParseFallbackMode
                        ? formatFallbackModeLabel(mergedLabels, selectedParseFallbackMode)
                        : mergedLabels.diagnosticsStructured}
                    </strong>
                  </div>
                  <div className="artifact-meta-card">
                    <span>{mergedLabels.diagnosticsShotCount}</span>
                    <strong>{selectedShotCount ?? selectedShots.length}</strong>
                  </div>
                  <div className="artifact-meta-card">
                    <span>{mergedLabels.diagnosticsInvalidShots}</span>
                    <strong>
                      {selectedInvalidShotIndexes.length > 0
                        ? selectedInvalidShotIndexes.map((index) => index + 1).join(', ')
                        : mergedLabels.valueNotProvided}
                    </strong>
                  </div>
                  <div className="artifact-meta-card">
                    <span>{mergedLabels.diagnosticsParseError}</span>
                    <strong>{selectedParseError || mergedLabels.valueNotProvided}</strong>
                  </div>
                </div>
                {selectedInvalidShotErrors.length > 0 ? (
                  <div className="source-job-card">
                    <strong>{mergedLabels.diagnosticsInvalidShots}</strong>
                    <p className="helper-text">{selectedInvalidShotErrors.join(' · ')}</p>
                  </div>
                ) : null}
              </section>

              <div className="artifact-detail-grid">
                <div className="artifact-meta-card">
                  <span>{mergedLabels.artifactKind}</span>
                  <strong>{formatArtifactKind(locale, selectedArtifact.kind)}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{mergedLabels.createdAt}</span>
                  <strong>{formatLocaleDateTime(locale, selectedArtifact.createdAt)}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{mergedLabels.updatedAt}</span>
                  <strong>{formatLocaleDateTime(locale, selectedArtifact.updatedAt)}</strong>
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
                      <strong>{mergedLabels.characters}</strong>
                      <p className="helper-text">{selectedCharacters.join(' · ')}</p>
                    </div>
                  ) : null}

                  {selectedScenes.length > 0 ? (
                    <div className="artifact-source-summary">
                      <strong>{mergedLabels.scenes}</strong>
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
                {chainPreview ? <p className="helper-text">{chainPreview}</p> : null}

                {selectedSourceArtifacts.length === 0 ? (
                  <p className="helper-text">{mergedLabels.sourceFallback}</p>
                ) : (
                  <div className="source-chain-list">
                    {selectedSourceArtifacts.map((entry) => {
                      const artifact = entry.artifact;
                      const job = artifact
                        ? jobs.find((jobEntry) => jobEntry.id === artifact.generationJobId)
                        : null;
                      const relationLabel =
                        entry.relationType === 'metadata'
                          ? mergedLabels.sourceMetadata
                          : entry.relationType;

                      return (
                        <article key={entry.artifactId} className="source-chain-card">
                          <div className="list-row">
                            <div>
                              <strong>{artifact?.title ?? shortenId(entry.artifactId)}</strong>
                              <p>
                                {artifact
                                  ? `${formatArtifactKind(locale, artifact.kind)} · v${artifact.version}`
                                  : mergedLabels.sourceFallback}
                              </p>
                            </div>
                            {artifact ? (
                              <a
                                className="inline-link"
                                href={downloadHrefForArtifact?.(artifact) ?? `/api/artifacts/${artifact.id}/download`}
                              >
                                {mergedLabels.download}
                              </a>
                            ) : null}
                          </div>
                          <div className="artifact-browser-meta">
                            <span>{formatLocaleDateTime(locale, artifact?.createdAt ?? null)}</span>
                            <span>{relationLabel}</span>
                          </div>
                          {artifact?.content ? (
                            <p className="source-chain-snippet">{excerpt(artifact.content)}</p>
                          ) : null}
                          <div className="source-chain-actions">
                            {artifact && job ? (
                              <div className="source-job-card">
                                <strong>{mergedLabels.sourceJob}</strong>
                                <p>
                                  {formatJobKind(locale, job.kind)} · {formatJobStatus(locale, job.status)} · {job.currentStep ?? 'idle'}
                                </p>
                                {job.outputSummary ? <p>{job.outputSummary}</p> : null}
                              </div>
                            ) : null}
                            {artifact && onSelectSourceArtifact ? (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => onSelectSourceArtifact(artifact.id)}
                              >
                                {artifact.kind === 'script' ? mergedLabels.jumpToScript : mergedLabels.jumpToSource}
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

function getDefaultLabels(locale: SupportedLocale) {
  if (locale === 'en-US') {
    return {
      emptyState: 'No storyboard artifacts yet.',
      noSelection: 'Select a storyboard artifact to inspect its text, source relation, and download link.',
      preview: 'Storyboard preview',
      download: 'Download',
      sourceChain: 'Source chain',
      sourceArtifacts: 'Source artifacts',
      sourceJob: 'Source job',
      sourceFallback: 'No linked source artifacts available.',
      sourceMetadata: 'Source metadata',
      relationCount: 'Relations',
      storyboardVersion: 'Version',
      storyboardVersions: 'Storyboard versions',
      storyboardJob: 'Story job',
      artifactKind: 'Kind',
      createdAt: 'Created',
      updatedAt: 'Updated',
      contentEmpty: 'No storyboard content available.',
      characters: 'Characters',
      scenes: 'Scenes',
      textView: 'Text View',
      shotView: 'Shot View',
      shotsEmpty: 'No structured shots available for this storyboard.',
      shotSceneId: 'Scene ID',
      shotId: 'Shot ID',
      shotType: 'Shot Type',
      shotCamera: 'Camera',
      shotComposition: 'Composition',
      shotMotion: 'Motion',
      shotSubject: 'Subject',
      shotEnvironment: 'Environment',
      shotLighting: 'Lighting',
      shotAudioHint: 'Audio Hint',
      shotVideoPrompt: 'Video Prompt',
      valueNotProvided: 'N/A',
      jumpToScript: 'Jump to script version',
      jumpToSource: 'Jump to source version',
      diagnostics: 'Parse diagnostics',
      diagnosticsSummary: 'Structured JSON was incomplete, so the system filled the storyboard from text output.',
      diagnosticsFallbackMode: 'Parse mode',
      diagnosticsStructured: 'Structured JSON',
      diagnosticsTextDerived: 'Text-derived fallback',
      diagnosticsPartialTextDerived: 'Partial text-derived fallback',
      diagnosticsShotCount: 'Shot count',
      diagnosticsInvalidShots: 'Recovered shots',
      diagnosticsParseError: 'Parse signal',
      diagnosticsHealthy: 'This storyboard was parsed from structured output without a fallback path.',
    };
  }

  return {
    emptyState: '还没有分镜产物。',
    noSelection: '选择一个分镜版本后，可以查看内容、来源关系和下载入口。',
    preview: '分镜预览',
    download: '下载',
    sourceChain: '来源链路',
    sourceArtifacts: '来源产物',
    sourceJob: '来源任务',
    sourceFallback: '暂无可展示的来源产物。',
    sourceMetadata: '来源元数据',
    relationCount: '依赖数',
    storyboardVersion: '版本',
    storyboardVersions: '分镜版本',
    storyboardJob: '分镜任务',
    artifactKind: '类型',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    contentEmpty: '当前分镜没有可展示内容。',
    characters: '角色',
    scenes: '场景',
    textView: '文本视图',
    shotView: '镜头视图',
    shotsEmpty: '当前分镜没有可展示的结构化镜头。',
    shotSceneId: '场景编号',
    shotId: '镜头编号',
    shotType: '镜头类型',
    shotCamera: '机位',
    shotComposition: '构图',
    shotMotion: '运镜',
    shotSubject: '主体',
    shotEnvironment: '环境',
    shotLighting: '光线',
    shotAudioHint: '音频提示',
    shotVideoPrompt: '视频提示词',
    valueNotProvided: '未提供',
    jumpToScript: '跳转到对应剧本版本',
    jumpToSource: '跳转到来源版本',
    diagnostics: '解析诊断',
    diagnosticsSummary: '结构化 JSON 没有完整命中，系统已根据文本结果补齐分镜内容。',
    diagnosticsFallbackMode: '解析模式',
    diagnosticsStructured: '结构化 JSON',
    diagnosticsTextDerived: '文本兜底',
    diagnosticsPartialTextDerived: '局部文本补位',
    diagnosticsShotCount: '镜头数量',
    diagnosticsInvalidShots: '补位镜头',
    diagnosticsParseError: '解析信号',
    diagnosticsHealthy: '当前分镜直接来自结构化输出，没有触发兜底路径。',
  };
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

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readStoryboardShots(value: unknown): StoryboardShot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const sceneId = readShotField(candidate.sceneId);
    const shotId = readShotField(candidate.shotId);
    const shotType = readShotField(candidate.shotType);
    const camera = readShotField(candidate.camera);
    const composition = readShotField(candidate.composition);
    const motion = readShotField(candidate.motion);
    const subject = readShotField(candidate.subject);
    const environment = readShotField(candidate.environment);
    const lighting = readShotField(candidate.lighting);
    const audioHint = readShotField(candidate.audioHint);
    const videoPrompt = readShotField(candidate.videoPrompt);

    if (!sceneId && !shotId && !shotType && !videoPrompt) {
      return [];
    }

    return [
      {
        sceneId,
        shotId,
        shotType,
        camera,
        composition,
        motion,
        subject,
        environment,
        lighting,
        audioHint,
        videoPrompt,
      },
    ];
  });
}

function readShotField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item));
}

function readParseFallbackMode(value: unknown): 'text-derived' | 'partial-text-derived' | null {
  return value === 'text-derived' || value === 'partial-text-derived' ? value : null;
}

function formatFallbackModeLabel(
  labels: NonNullable<StoryboardPanelProps['labels']> & ReturnType<typeof getDefaultLabels>,
  mode: 'text-derived' | 'partial-text-derived'
) {
  return mode === 'partial-text-derived'
    ? labels.diagnosticsPartialTextDerived
    : labels.diagnosticsTextDerived;
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

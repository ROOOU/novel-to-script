'use client';

import type { SupportedLocale } from '@/server/shared/platform/domain';
import { formatLocaleDateTime } from '@/features/saas/project/presentation';
import type {
  StoryboardScopeSceneOption,
  StoryboardScopeSourceOption,
} from '@/features/saas/project/storyboard-scope';

interface StoryboardGenerationPanelProps {
  locale: SupportedLocale;
  title: string;
  subtitle: string;
  labels: {
    emptyState: string;
    sourceVersions: string;
    useLatestVersions: string;
    episodeFilter: string;
    episodeFilterHint: string;
    sceneFilter: string;
    sceneFilterHint: string;
    noEpisodes: string;
    noScenes: string;
    clearFilters: string;
    generate: string;
    versionPrefix: string;
    episodePrefix: string;
  };
  sourceOptions: StoryboardScopeSourceOption[];
  selectedArtifactIds: string[];
  selectedEpisodeNumbers: number[];
  selectedSceneIds: string[];
  episodeOptions: number[];
  sceneOptions: StoryboardScopeSceneOption[];
  message: string | null;
  running: boolean;
  onResetSources: () => void;
  onToggleArtifact: (artifactId: string) => void;
  onToggleEpisode: (episodeNumber: number) => void;
  onToggleScene: (sceneId: string) => void;
  onClearFilters: () => void;
  onGenerate: () => void;
}

export function StoryboardGenerationPanel({
  locale,
  title,
  subtitle,
  labels,
  sourceOptions,
  selectedArtifactIds,
  selectedEpisodeNumbers,
  selectedSceneIds,
  episodeOptions,
  sceneOptions,
  message,
  running,
  onResetSources,
  onToggleArtifact,
  onToggleEpisode,
  onToggleScene,
  onClearFilters,
  onGenerate,
}: StoryboardGenerationPanelProps) {
  const selectedArtifactIdSet = new Set(selectedArtifactIds);
  const selectedEpisodeNumberSet = new Set(selectedEpisodeNumbers);
  const selectedSceneIdSet = new Set(selectedSceneIds);
  const hasSourceOptions = sourceOptions.length > 0;
  const hasSelectionFilters =
    selectedEpisodeNumbers.length > 0 || selectedSceneIds.length > 0;

  return (
    <article className="card stack-gap">
      <div className="stack-gap-sm">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {!hasSourceOptions ? (
        <p className="helper-text">{labels.emptyState}</p>
      ) : (
        <>
          <section className="stack-gap-sm">
            <div className="list-row">
              <strong>{labels.sourceVersions}</strong>
              <button type="button" className="ghost-button" onClick={onResetSources}>
                {labels.useLatestVersions}
              </button>
            </div>
            <div className="artifact-filter-bar">
              {sourceOptions.map((option) => {
                const active = selectedArtifactIdSet.has(option.artifactId);
                return (
                  <button
                    key={option.artifactId}
                    type="button"
                    className={`filter-chip storyboard-scope-chip ${active ? 'active' : ''}`}
                    onClick={() => onToggleArtifact(option.artifactId)}
                  >
                    <strong>{option.title}</strong>
                    <span>{`${labels.versionPrefix} ${option.version}`}</span>
                    {option.episodeNumber ? (
                      <span>{`${labels.episodePrefix} ${option.episodeNumber}`}</span>
                    ) : null}
                    <span>{formatLocaleDateTime(locale, option.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="stack-gap-sm">
            <strong>{labels.episodeFilter}</strong>
            <p className="helper-text">{labels.episodeFilterHint}</p>
            {episodeOptions.length === 0 ? (
              <p className="helper-text">{labels.noEpisodes}</p>
            ) : (
              <div className="artifact-filter-bar">
                {episodeOptions.map((episodeNumber) => (
                  <button
                    key={episodeNumber}
                    type="button"
                    className={`filter-chip ${selectedEpisodeNumberSet.has(episodeNumber) ? 'active' : ''}`}
                    onClick={() => onToggleEpisode(episodeNumber)}
                  >
                    <strong>{`${labels.episodePrefix} ${episodeNumber}`}</strong>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="stack-gap-sm">
            <strong>{labels.sceneFilter}</strong>
            <p className="helper-text">{labels.sceneFilterHint}</p>
            {sceneOptions.length === 0 ? (
              <p className="helper-text">{labels.noScenes}</p>
            ) : (
              <div className="artifact-filter-bar">
                {sceneOptions.map((scene) => (
                  <button
                    key={`${scene.artifactId}:${scene.id}`}
                    type="button"
                    className={`filter-chip storyboard-scope-chip ${selectedSceneIdSet.has(scene.id) ? 'active' : ''}`}
                    onClick={() => onToggleScene(scene.id)}
                  >
                    <strong>{scene.id}</strong>
                    <span>{scene.heading}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={onClearFilters}
              disabled={!hasSelectionFilters}
            >
              {labels.clearFilters}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onGenerate}
              disabled={running || selectedArtifactIds.length === 0}
            >
              {labels.generate}
            </button>
          </div>
        </>
      )}

      {message ? <p className="helper-text">{message}</p> : null}
    </article>
  );
}

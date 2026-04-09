'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ArtifactRelation,
  GenerationArtifact,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import {
  createEmptyAnalysisDraft,
  createEmptyOutlineEntry,
  joinLines,
  parseAnalysisDraft,
  parseOutlineDraft,
  serializeAnalysisDraft,
  serializeOutlineDraft,
  splitLines,
} from '@/lib/artifact-editors';
import { summarizeVersionDiff } from '@/lib/version-summary';
import type { Character, NovelAnalysis, OutlineEntry } from '@/lib/types';
import {
  collectArtifactIdsFromMetadata,
  deriveArtifactLineage,
} from '@/features/saas/project/artifact-lineage';

type ArtifactKind = 'analysis' | 'outline' | 'script';

interface ProjectArtifactStudioPanelProps {
  locale: SupportedLocale;
  title: string;
  subtitle: string;
  artifacts: GenerationArtifact[];
  artifactRelations?: ArtifactRelation[];
  allowedKinds?: ArtifactKind[];
  initialKind?: ArtifactKind;
  selectedArtifactId?: string | null;
  hideKindTabs?: boolean;
  scriptPrimaryActionLabel?: string;
  onRunScriptPrimaryAction?: (artifact: GenerationArtifact) => Promise<void> | void;
  labels: {
    analysisTab: string;
    outlineTab: string;
    scriptTab: string;
    structuredHint: string;
    versionHistory: string;
    versionCount: string;
    basedOnVersion: string;
    createdAtLabel: string;
    changedLines: string;
    characterDelta: string;
    resetDraft: string;
    saveVersion: string;
    parseError: string;
    rawContentLabel: string;
    rawContentHint: string;
    noArtifacts: string;
    noVersions: string;
    selectVersion: string;
    artifactTitleField: string;
    currentVersionLabel: string;
    latestVersionLabel: string;
    analysisEditorTitle: string;
    analysisTitleField: string;
    analysisGenreField: string;
    plotSummaryField: string;
    keyConflictsField: string;
    climaxPointsField: string;
    emotionalBeatsField: string;
    charactersField: string;
    addCharacter: string;
    removeCharacter: string;
    characterName: string;
    characterDescription: string;
    characterPersonality: string;
    characterSpeechStyle: string;
    characterRelationships: string;
    outlineEditorTitle: string;
    outlineEpisodeNumber: string;
    outlineTitleField: string;
    outlineSummaryField: string;
    outlineKeyEventsField: string;
    outlineHookField: string;
    addEpisode: string;
    removeEpisode: string;
    scriptEditorTitle: string;
    scriptContentField: string;
    scriptHint: string;
  };
  onVersionSaved?: () => Promise<void> | void;
}

const ARTIFACT_KINDS: Array<{ kind: ArtifactKind; labelKey: keyof ProjectArtifactStudioPanelProps['labels'] }> = [
  { kind: 'analysis', labelKey: 'analysisTab' },
  { kind: 'outline', labelKey: 'outlineTab' },
  { kind: 'script', labelKey: 'scriptTab' },
];

export function ProjectArtifactStudioPanel({
  locale,
  title,
  subtitle,
  artifacts,
  artifactRelations = [],
  allowedKinds,
  initialKind,
  selectedArtifactId: controlledSelectedArtifactId,
  hideKindTabs,
  scriptPrimaryActionLabel,
  onRunScriptPrimaryAction,
  labels,
  onVersionSaved,
}: ProjectArtifactStudioPanelProps) {
  const uiCopy = getStudioUiCopy(locale);
  const [activeKind, setActiveKind] = useState<ArtifactKind>(initialKind ?? allowedKinds?.[0] ?? 'analysis');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const configuredKinds = useMemo(() => {
    if (!allowedKinds?.length) {
      return ARTIFACT_KINDS;
    }

    const allowedKindSet = new Set(allowedKinds);
    return ARTIFACT_KINDS.filter(({ kind }) => allowedKindSet.has(kind));
  }, [allowedKinds]);

  const availableKinds = useMemo(() => {
    return configuredKinds.filter(({ kind }) => artifacts.some((artifact) => artifact.kind === kind));
  }, [artifacts, configuredKinds]);

  useEffect(() => {
    if (!initialKind) {
      return;
    }

    setActiveKind(initialKind);
  }, [initialKind]);

  useEffect(() => {
    if (availableKinds.length === 0) {
      return;
    }

    if (!availableKinds.some(({ kind }) => kind === activeKind)) {
      setActiveKind(availableKinds[0].kind);
    }
  }, [activeKind, availableKinds]);

  const kindArtifacts = useMemo(() => {
    return artifacts
      .filter((artifact) => artifact.kind === activeKind)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.version - left.version);
  }, [activeKind, artifacts]);

  useEffect(() => {
    if (selectedArtifactId && kindArtifacts.some((artifact) => artifact.id === selectedArtifactId)) {
      return;
    }

    setSelectedArtifactId(kindArtifacts[0]?.id ?? null);
  }, [kindArtifacts, selectedArtifactId]);

  useEffect(() => {
    if (!controlledSelectedArtifactId) {
      return;
    }

    if (!kindArtifacts.some((artifact) => artifact.id === controlledSelectedArtifactId)) {
      return;
    }

    setSelectedArtifactId(controlledSelectedArtifactId);
  }, [controlledSelectedArtifactId, kindArtifacts]);

  const selectedArtifact = kindArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? kindArtifacts[0] ?? null;

  useEffect(() => {
    setDraftTitle(selectedArtifact?.title ?? '');
    setDraftContent(selectedArtifact?.content ?? '');
    setMessage(null);
  }, [selectedArtifact?.content, selectedArtifact?.id, selectedArtifact?.title]);

  const versionHistory = useMemo(() => {
    if (!selectedArtifact) {
      return [];
    }

    const groupId = selectedArtifact.versionGroupId ?? selectedArtifact.id;
    return artifacts
      .filter((artifact) => artifact.kind === activeKind && (artifact.versionGroupId ?? artifact.id) === groupId)
      .sort((left, right) => left.version - right.version || left.createdAt.localeCompare(right.createdAt));
  }, [activeKind, artifacts, selectedArtifact]);

  const previousVersion = useMemo(() => {
    if (!selectedArtifact) {
      return null;
    }

    return versionHistory
      .filter((artifact) => artifact.id !== selectedArtifact.id && artifact.version < selectedArtifact.version)
      .sort((left, right) => right.version - left.version || right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  }, [selectedArtifact, versionHistory]);

  const diffSummary = useMemo(
    () => summarizeVersionDiff(previousVersion?.content, selectedArtifact?.content),
    [previousVersion?.content, selectedArtifact?.content]
  );

  const sourceArtifacts = useMemo(() => {
    if (!selectedArtifact) {
      return [];
    }

    return deriveArtifactLineage(selectedArtifact, artifacts, artifactRelations).directUpstream;
  }, [artifactRelations, artifacts, selectedArtifact]);
  const sourceArtifactIds = sourceArtifacts.length
    ? sourceArtifacts.map((entry) => entry.artifactId)
    : collectArtifactIdsFromMetadata(selectedArtifact?.metadata);

  const downloadHref = selectedArtifact ? `/api/artifacts/${selectedArtifact.id}/download` : null;
  const selectedArtifactContent = selectedArtifact?.content?.trim() ?? '';
  const rootVersion = versionHistory[0] ?? null;

  const analysisDraft = useMemo(() => {
    if (activeKind !== 'analysis') {
      return createEmptyAnalysisDraft();
    }

    return parseAnalysisDraft(draftContent).value ?? createEmptyAnalysisDraft();
  }, [activeKind, draftContent]);

  const analysisParseError = activeKind === 'analysis' ? parseAnalysisDraft(draftContent).error : null;

  const outlineDraft = useMemo(() => {
    if (activeKind !== 'outline') {
      return [] as OutlineEntry[];
    }

    return parseOutlineDraft(draftContent).value ?? [];
  }, [activeKind, draftContent]);

  const outlineParseError = activeKind === 'outline' ? parseOutlineDraft(draftContent).error : null;

  async function handleSaveVersion() {
    if (!selectedArtifact) {
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/artifacts/${selectedArtifact.id}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: draftTitle || selectedArtifact.title,
        content: draftContent,
      }),
    });
    setSaving(false);
    const payload = await response.json();
    if (!payload.ok) {
      setMessage(payload.error ?? labels.parseError);
      return;
    }

    setMessage(labels.saveVersion);
    if (payload.version?.id) {
      setSelectedArtifactId(payload.version.id);
    }
    await onVersionSaved?.();
  }

  function updateAnalysis(next: NovelAnalysis) {
    setDraftContent(serializeAnalysisDraft(next));
  }

  function updateOutline(next: OutlineEntry[]) {
    setDraftContent(serializeOutlineDraft(next));
  }

  function resetDraft() {
    setDraftTitle(selectedArtifact?.title ?? '');
    setDraftContent(selectedArtifact?.content ?? '');
  }

  async function handleCopyArtifactContent() {
    if (!selectedArtifactContent) {
      setMessage(uiCopy.noContentToCopy);
      return;
    }

    try {
      await copyTextToClipboard(selectedArtifactContent);
      setMessage(uiCopy.copySuccess);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : uiCopy.copyFailure);
    }
  }

  return (
    <article className="card stack-gap">
      <div className="stack-gap-sm">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <section className="segmented-control">
        {!hideKindTabs ? configuredKinds.map(({ kind, labelKey }) => (
          <button
            key={kind}
            type="button"
            className={`segment ${activeKind === kind ? 'active' : ''}`}
            onClick={() => setActiveKind(kind)}
          >
            {labels[labelKey]}
          </button>
        )) : null}
      </section>

      <div className="version-layout">
        <div className="version-list">
          <div className="list-row">
            <strong>{labels.versionHistory}</strong>
            <span>{kindArtifacts.length}</span>
          </div>
          <p className="helper-text">{labels.selectVersion}</p>
          {kindArtifacts.length === 0 ? (
            <p>{labels.noVersions}</p>
          ) : (
            kindArtifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={`version-item ${selectedArtifact?.id === artifact.id ? 'active' : ''}`}
                onClick={() => setSelectedArtifactId(artifact.id)}
              >
                <strong>{artifact.title}</strong>
                <span>{artifact.kind}</span>
                <small>
                  v{artifact.version} · {new Date(artifact.createdAt).toLocaleDateString(locale)}
                </small>
              </button>
            ))
          )}
        </div>

        {selectedArtifact ? (
          <div className="artifact-block stack-gap">
            <div className="list-row">
              <div>
                <strong>{selectedArtifact.title}</strong>
                <p>
                  {labels.currentVersionLabel} v{selectedArtifact.version}
                </p>
              </div>
              <div className="list-row-meta">
                <span>{labels.latestVersionLabel}</span>
                <span>{selectedArtifact.kind}</span>
              </div>
            </div>

            <div className="artifact-meta-grid">
              <div className="artifact-meta-card">
                <span>{labels.versionCount}</span>
                <strong>{versionHistory.length}</strong>
              </div>
              <div className="artifact-meta-card">
                <span>{labels.basedOnVersion}</span>
                <strong>{previousVersion ? `v${previousVersion.version}` : 'v1'}</strong>
              </div>
              <div className="artifact-meta-card">
                <span>{labels.changedLines}</span>
                <strong>{diffSummary.changedLines}</strong>
              </div>
              <div className="artifact-meta-card">
                <span>{labels.characterDelta}</span>
                <strong>{diffSummary.characterDelta >= 0 ? `+${diffSummary.characterDelta}` : diffSummary.characterDelta}</strong>
              </div>
            </div>

            <div className="stack-gap-sm">
              <strong>{uiCopy.sourceContext}</strong>
              <div className="artifact-meta-grid">
                <div className="artifact-meta-card">
                  <span>{uiCopy.currentVersion}</span>
                  <strong>v{selectedArtifact.version}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{uiCopy.rootVersion}</span>
                  <strong>{rootVersion ? `v${rootVersion.version}` : uiCopy.initialVersion}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{uiCopy.previousVersion}</span>
                  <strong>{previousVersion ? `v${previousVersion.version}` : uiCopy.initialState}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{uiCopy.versionGroup}</span>
                  <strong>{shortenId(selectedArtifact.versionGroupId ?? selectedArtifact.id)}</strong>
                </div>
              </div>
              <div className="artifact-meta-grid">
                <div className="artifact-meta-card">
                  <span>{uiCopy.parentArtifact}</span>
                  <strong>
                    {selectedArtifact.parentArtifactId
                      ? shortenId(selectedArtifact.parentArtifactId)
                      : previousVersion
                        ? shortenId(previousVersion.id)
                        : '—'}
                  </strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{uiCopy.generationJob}</span>
                  <strong>{shortenId(selectedArtifact.generationJobId)}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{uiCopy.contentSource}</span>
                  <strong>{selectedArtifact.metadata ? uiCopy.artifactMetadata : uiCopy.artifactContent}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{uiCopy.sourceLinks}</span>
                  <strong>{sourceArtifactIds.length}</strong>
                </div>
              </div>
              {sourceArtifactIds.length > 0 ? (
                <div className="stack-gap-sm">
                  <strong>{uiCopy.sourceArtifactIds}</strong>
                  <div className="list-row-meta" style={{ flexWrap: 'wrap' }}>
                    {sourceArtifactIds.map((artifactId) => {
                      const sourceArtifact = sourceArtifacts.find((entry) => entry.artifactId === artifactId);
                      return (
                        <span key={artifactId} className="chip">
                          {sourceArtifact?.artifact
                            ? `${sourceArtifact.artifact.title} · v${sourceArtifact.artifact.version}`
                            : shortenId(artifactId)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="helper-text">
                  {uiCopy.noSourceArtifacts}
                </p>
              )}
            </div>

            <div className="action-row">
              <a
                className="secondary-button"
                href={downloadHref ?? '#'}
                aria-disabled={!downloadHref}
                onClick={(event) => {
                  if (!downloadHref) {
                    event.preventDefault();
                  }
                }}
              >
                {uiCopy.downloadCurrentVersion}
              </a>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCopyArtifactContent}
                disabled={!selectedArtifactContent}
              >
                {uiCopy.copyContent}
              </button>
              {activeKind === 'script' && selectedArtifact && onRunScriptPrimaryAction ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onRunScriptPrimaryAction(selectedArtifact)}
                >
                  {scriptPrimaryActionLabel ?? 'Continue from this script'}
                </button>
              ) : null}
            </div>

            <p className="artifact-timestamp">
              {labels.createdAtLabel}: {new Date(selectedArtifact.createdAt).toLocaleString(locale)}
            </p>

            <label className="field">
              <span>{labels.artifactTitleField}</span>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={selectedArtifact.title}
              />
            </label>

            {activeKind === 'analysis' ? (
              <AnalysisEditor
                locale={locale}
                labels={labels}
                draft={analysisDraft}
                parseError={analysisParseError}
                draftContent={draftContent}
                onChange={updateAnalysis}
                onRawChange={setDraftContent}
              />
            ) : null}

            {activeKind === 'outline' ? (
              <OutlineEditor
                labels={labels}
                draft={outlineDraft}
                parseError={outlineParseError}
                draftContent={draftContent}
                onChange={updateOutline}
                onRawChange={setDraftContent}
              />
            ) : null}

            {activeKind === 'script' ? (
              <ScriptEditor
                labels={labels}
                draftContent={draftContent}
                onRawChange={setDraftContent}
              />
            ) : null}

            <div className="action-row">
              <button type="button" className="secondary-button" onClick={resetDraft}>
                {labels.resetDraft}
              </button>
              <button type="button" className="primary-button" onClick={handleSaveVersion} disabled={saving}>
                {labels.saveVersion}
              </button>
            </div>
            {message ? <p className="helper-text">{message}</p> : null}
          </div>
        ) : (
          <div className="artifact-block">
            <p>{labels.noArtifacts}</p>
          </div>
        )}
      </div>
    </article>
  );
}

function AnalysisEditor({
  locale,
  labels,
  draft,
  parseError,
  draftContent,
  onChange,
  onRawChange,
}: {
  locale: SupportedLocale;
  labels: ProjectArtifactStudioPanelProps['labels'];
  draft: NovelAnalysis;
  parseError: string | null;
  draftContent: string;
  onChange: (draft: NovelAnalysis) => void;
  onRawChange: (value: string) => void;
}) {
  return (
    <div className="stack-gap">
      <h3>{labels.analysisEditorTitle}</h3>
      <p className="helper-text">{labels.structuredHint}</p>
      {parseError ? (
        <div className="error-message">
          {labels.parseError}: {parseError}
        </div>
      ) : null}
      <div className="analysis-grid">
        <label className="analysis-item field">
          <span className="analysis-item-label">{labels.analysisTitleField}</span>
          <input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
        </label>
        <label className="analysis-item field">
          <span className="analysis-item-label">{labels.analysisGenreField}</span>
          <select value={draft.genre} onChange={(event) => onChange({ ...draft, genre: event.target.value as NovelAnalysis['genre'] })}>
            <option value="urban">{locale === 'en-US' ? 'Urban romance' : '都市情感'}</option>
            <option value="xianxia">{locale === 'en-US' ? 'Xianxia' : '仙侠'}</option>
            <option value="fantasy">{locale === 'en-US' ? 'Fantasy adventure' : '奇幻冒险'}</option>
          </select>
        </label>
        <label className="analysis-item field" style={{ gridColumn: '1 / -1' }}>
          <span className="analysis-item-label">{labels.plotSummaryField}</span>
          <textarea value={draft.plotSummary} onChange={(event) => onChange({ ...draft, plotSummary: event.target.value })} rows={4} />
        </label>
        <label className="analysis-item field">
          <span className="analysis-item-label">{labels.keyConflictsField}</span>
          <textarea
            value={joinLines(draft.keyConflicts)}
            onChange={(event) => onChange({ ...draft, keyConflicts: splitLines(event.target.value) })}
            rows={4}
          />
        </label>
        <label className="analysis-item field">
          <span className="analysis-item-label">{labels.climaxPointsField}</span>
          <textarea
            value={joinLines(draft.climaxPoints)}
            onChange={(event) => onChange({ ...draft, climaxPoints: splitLines(event.target.value) })}
            rows={4}
          />
        </label>
        <label className="analysis-item field" style={{ gridColumn: '1 / -1' }}>
          <span className="analysis-item-label">{labels.emotionalBeatsField}</span>
          <textarea
            value={joinLines(draft.emotionalBeats)}
            onChange={(event) => onChange({ ...draft, emotionalBeats: splitLines(event.target.value) })}
            rows={4}
          />
        </label>
      </div>

      <div className="stack-gap-sm">
        <div className="list-row">
          <strong>{labels.charactersField}</strong>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              onChange({
                ...draft,
                characters: [
                  ...draft.characters,
                  {
                    name: '',
                    description: '',
                    personality: '',
                    speechStyle: '',
                    relationships: [],
                  },
                ],
              })
            }
          >
            {labels.addCharacter}
          </button>
        </div>
        <div className="stack-gap-sm">
          {draft.characters.map((character, index) => (
            <CharacterEditor
              key={`${character.name || 'character'}-${index}`}
              labels={labels}
              character={character}
              index={index}
              onChange={(nextCharacter) =>
                onChange({
                  ...draft,
                  characters: draft.characters.map((item, currentIndex) => (currentIndex === index ? nextCharacter : item)),
                })
              }
              onRemove={() =>
                onChange({
                  ...draft,
                  characters: draft.characters.filter((_, currentIndex) => currentIndex !== index),
                })
              }
            />
          ))}
        </div>
      </div>

      <details>
        <summary>{labels.rawContentLabel}</summary>
        <p className="helper-text">{labels.rawContentHint}</p>
        <textarea
          className="artifact-editor"
          value={draftContent}
          onChange={(event) => onRawChange(event.target.value)}
          rows={12}
        />
      </details>
    </div>
  );
}

function CharacterEditor({
  labels,
  character,
  index,
  onChange,
  onRemove,
}: {
  labels: ProjectArtifactStudioPanelProps['labels'];
  character: Character;
  index: number;
  onChange: (character: Character) => void;
  onRemove: () => void;
}) {
  return (
    <div className="analysis-item stack-gap-sm">
      <div className="list-row">
        <strong>
          {labels.characterName} {index + 1}
        </strong>
        <button type="button" className="secondary-button" onClick={onRemove}>
          {labels.removeCharacter}
        </button>
      </div>
      <label className="field">
        <span>{labels.characterName}</span>
        <input value={character.name} onChange={(event) => onChange({ ...character, name: event.target.value })} />
      </label>
      <label className="field">
        <span>{labels.characterDescription}</span>
        <textarea value={character.description} onChange={(event) => onChange({ ...character, description: event.target.value })} rows={3} />
      </label>
      <label className="field">
        <span>{labels.characterPersonality}</span>
        <textarea value={character.personality} onChange={(event) => onChange({ ...character, personality: event.target.value })} rows={3} />
      </label>
      <label className="field">
        <span>{labels.characterSpeechStyle}</span>
        <textarea value={character.speechStyle} onChange={(event) => onChange({ ...character, speechStyle: event.target.value })} rows={3} />
      </label>
      <label className="field">
        <span>{labels.characterRelationships}</span>
        <textarea
          value={joinLines(character.relationships)}
          onChange={(event) => onChange({ ...character, relationships: splitLines(event.target.value) })}
          rows={3}
        />
      </label>
    </div>
  );
}

function OutlineEditor({
  labels,
  draft,
  parseError,
  draftContent,
  onChange,
  onRawChange,
}: {
  labels: ProjectArtifactStudioPanelProps['labels'];
  draft: OutlineEntry[];
  parseError: string | null;
  draftContent: string;
  onChange: (draft: OutlineEntry[]) => void;
  onRawChange: (value: string) => void;
}) {
  return (
    <div className="stack-gap">
      <h3>{labels.outlineEditorTitle}</h3>
      <p className="helper-text">{labels.structuredHint}</p>
      {parseError ? (
        <div className="error-message">
          {labels.parseError}: {parseError}
        </div>
      ) : null}
      <div className="stack-gap-sm">
        <div className="list-row">
          <strong>{labels.versionHistory}</strong>
          <button type="button" className="secondary-button" onClick={() => onChange([...draft, createEmptyOutlineEntry(draft.length + 1)])}>
            {labels.addEpisode}
          </button>
        </div>
        <div className="stack-gap-sm">
          {draft.map((entry, index) => (
            <div key={`${entry.episodeNumber}-${index}`} className="analysis-item stack-gap-sm">
              <div className="list-row">
                <strong>
                  {labels.outlineEpisodeNumber} {entry.episodeNumber}
                </strong>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onChange(draft.filter((_, currentIndex) => currentIndex !== index))}
                >
                  {labels.removeEpisode}
                </button>
              </div>
              <div className="analysis-grid">
                <label className="analysis-item field">
                  <span className="analysis-item-label">{labels.outlineEpisodeNumber}</span>
                  <input
                    type="number"
                    min={1}
                    value={entry.episodeNumber}
                    onChange={(event) =>
                      onChange(
                        draft.map((item, currentIndex) =>
                          currentIndex === index ? { ...entry, episodeNumber: Number(event.target.value) } : item
                        )
                      )
                    }
                  />
                </label>
                <label className="analysis-item field">
                  <span className="analysis-item-label">{labels.outlineTitleField}</span>
                  <input
                    value={entry.title}
                    onChange={(event) =>
                      onChange(draft.map((item, currentIndex) => (currentIndex === index ? { ...entry, title: event.target.value } : item)))
                    }
                  />
                </label>
                <label className="analysis-item field" style={{ gridColumn: '1 / -1' }}>
                  <span className="analysis-item-label">{labels.outlineSummaryField}</span>
                  <textarea
                    value={entry.summary}
                    onChange={(event) =>
                      onChange(draft.map((item, currentIndex) => (currentIndex === index ? { ...entry, summary: event.target.value } : item)))
                    }
                    rows={4}
                  />
                </label>
                <label className="analysis-item field">
                  <span className="analysis-item-label">{labels.outlineKeyEventsField}</span>
                  <textarea
                    value={joinLines(entry.keyEvents)}
                    onChange={(event) =>
                      onChange(
                        draft.map((item, currentIndex) =>
                          currentIndex === index ? { ...entry, keyEvents: splitLines(event.target.value) } : item
                        )
                      )
                    }
                    rows={4}
                  />
                </label>
                <label className="analysis-item field">
                  <span className="analysis-item-label">{labels.outlineHookField}</span>
                  <textarea
                    value={entry.hook}
                    onChange={(event) =>
                      onChange(draft.map((item, currentIndex) => (currentIndex === index ? { ...entry, hook: event.target.value } : item)))
                    }
                    rows={4}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
      <details>
        <summary>{labels.rawContentLabel}</summary>
        <p className="helper-text">{labels.rawContentHint}</p>
        <textarea
          className="artifact-editor"
          value={draftContent}
          onChange={(event) => onRawChange(event.target.value)}
          rows={12}
        />
      </details>
    </div>
  );
}

function ScriptEditor({
  labels,
  draftContent,
  onRawChange,
}: {
  labels: ProjectArtifactStudioPanelProps['labels'];
  draftContent: string;
  onRawChange: (value: string) => void;
}) {
  return (
    <div className="stack-gap">
      <h3>{labels.scriptEditorTitle}</h3>
      <p className="helper-text">{labels.scriptHint}</p>
      <label className="field">
        <span>{labels.scriptContentField}</span>
        <textarea className="artifact-editor" value={draftContent} onChange={(event) => onRawChange(event.target.value)} rows={20} />
      </label>
    </div>
  );
}

function shortenId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function getStudioUiCopy(locale: SupportedLocale) {
  if (locale === 'en-US') {
    return {
      noContentToCopy: 'No content available to copy.',
      copySuccess: 'Copied artifact content to clipboard.',
      copyFailure: 'Failed to copy artifact content.',
      sourceContext: 'Source context',
      currentVersion: 'Current version',
      rootVersion: 'Root version',
      previousVersion: 'Previous version',
      versionGroup: 'Version group',
      parentArtifact: 'Parent artifact',
      generationJob: 'Generation job',
      contentSource: 'Content source',
      sourceLinks: 'Source links',
      sourceArtifactIds: 'Source artifact IDs',
      noSourceArtifacts: 'No upstream artifact metadata found for this version.',
      downloadCurrentVersion: 'Download current version',
      copyContent: 'Copy content',
      artifactMetadata: 'artifact metadata',
      artifactContent: 'artifact content',
      initialVersion: 'v1',
      initialState: 'Initial',
    };
  }

  return {
    noContentToCopy: '当前没有可复制的内容。',
    copySuccess: '已复制当前产物内容。',
    copyFailure: '复制产物内容失败。',
    sourceContext: '来源上下文',
    currentVersion: '当前版本',
    rootVersion: '根版本',
    previousVersion: '上一版本',
    versionGroup: '版本组',
    parentArtifact: '父级产物',
    generationJob: '生成任务',
    contentSource: '内容来源',
    sourceLinks: '来源链接',
    sourceArtifactIds: '来源产物 ID',
    noSourceArtifacts: '当前版本没有上游产物元数据。',
    downloadCurrentVersion: '下载当前版本',
    copyContent: '复制内容',
    artifactMetadata: '产物元数据',
    artifactContent: '产物内容',
    initialVersion: 'v1',
    initialState: '初始版本',
  };
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Clipboard access is unavailable in this browser.');
  }
}

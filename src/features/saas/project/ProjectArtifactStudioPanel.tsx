'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GenerationArtifact, SupportedLocale } from '@/server/shared/platform/domain';
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

type ArtifactKind = 'analysis' | 'outline' | 'script';

interface ProjectArtifactStudioPanelProps {
  locale: SupportedLocale;
  title: string;
  subtitle: string;
  artifacts: GenerationArtifact[];
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
  labels,
  onVersionSaved,
}: ProjectArtifactStudioPanelProps) {
  const [activeKind, setActiveKind] = useState<ArtifactKind>('analysis');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const availableKinds = useMemo(() => {
    return ARTIFACT_KINDS.filter(({ kind }) => artifacts.some((artifact) => artifact.kind === kind));
  }, [artifacts]);

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

  return (
    <article className="card stack-gap">
      <div className="stack-gap-sm">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <section className="segmented-control">
        {ARTIFACT_KINDS.map(({ kind, labelKey }) => (
          <button
            key={kind}
            type="button"
            className={`segment ${activeKind === kind ? 'active' : ''}`}
            onClick={() => setActiveKind(kind)}
          >
            {labels[labelKey]}
          </button>
        ))}
      </section>

      <div className="version-layout">
        <div className="version-list">
          <div className="list-row">
            <strong>{labels.versionHistory}</strong>
            <span>{kindArtifacts.length}</span>
          </div>
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

            {message ? <p className="helper-text">{message}</p> : null}

            <div className="action-row">
              <button type="button" className="secondary-button" onClick={resetDraft}>
                {labels.resetDraft}
              </button>
              <button type="button" className="primary-button" onClick={handleSaveVersion} disabled={saving}>
                {labels.saveVersion}
              </button>
            </div>
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
  labels,
  draft,
  parseError,
  draftContent,
  onChange,
  onRawChange,
}: {
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
            <option value="urban">urban</option>
            <option value="xianxia">xianxia</option>
            <option value="fantasy">fantasy</option>
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

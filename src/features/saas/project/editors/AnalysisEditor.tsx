import type { NovelAnalysis } from '@/lib/types';
import { joinLines, splitLines } from '@/lib/artifact-editors';
import type { ProjectArtifactStudioPanelProps } from '../ProjectArtifactStudioPanel';
import { CharacterEditor } from './CharacterEditor';

export function AnalysisEditor({
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

import type { Character } from '@/lib/types';
import { joinLines, splitLines } from '@/lib/artifact-editors';
import type { ProjectArtifactStudioPanelProps } from '../ProjectArtifactStudioPanel';

export function CharacterEditor({
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

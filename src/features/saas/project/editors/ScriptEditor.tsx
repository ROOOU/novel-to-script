import type { ProjectArtifactStudioPanelProps } from '../ProjectArtifactStudioPanel';

export function ScriptEditor({
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

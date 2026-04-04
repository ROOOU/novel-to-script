'use client';

interface SourceEditorPanelProps {
  labels: {
    sourceTitle: string;
    sourceHint: string;
    saveSource: string;
    generateScript: string;
    generateStoryboard: string;
    sourceLabel: string;
    genre: string;
    episodeCount: string;
    episodeDuration: string;
    style: string;
  };
  sourceTitle: string;
  sourceText: string;
  genre: string;
  episodeCount: number;
  episodeDuration: string;
  style: string;
  message: string | null;
  saving: boolean;
  runningKind: string | null;
  pipelineActionLabel?: string;
  onSourceTitleChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
  onGenreChange: (value: string) => void;
  onEpisodeCountChange: (value: number) => void;
  onEpisodeDurationChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  onSaveSource: () => void;
  onRunScript: () => void;
  onRunPipeline: () => void;
}

export function SourceEditorPanel({
  labels,
  sourceTitle,
  sourceText,
  genre,
  episodeCount,
  episodeDuration,
  style,
  message,
  saving,
  runningKind,
  pipelineActionLabel,
  onSourceTitleChange,
  onSourceTextChange,
  onGenreChange,
  onEpisodeCountChange,
  onEpisodeDurationChange,
  onStyleChange,
  onSaveSource,
  onRunScript,
  onRunPipeline,
}: SourceEditorPanelProps) {
  return (
    <article className="card stack-gap">
      <div>
        <h2>{labels.sourceTitle}</h2>
        <p>{labels.sourceHint}</p>
      </div>
      <label className="field">
        <span>{labels.sourceTitle}</span>
        <input value={sourceTitle} onChange={(event) => onSourceTitleChange(event.target.value)} />
      </label>
      <label className="field">
        <span>{labels.sourceLabel}</span>
        <textarea value={sourceText} onChange={(event) => onSourceTextChange(event.target.value)} rows={14} />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>{labels.genre}</span>
          <select value={genre} onChange={(event) => onGenreChange(event.target.value)}>
            <option value="urban">urban</option>
            <option value="xianxia">xianxia</option>
            <option value="fantasy">fantasy</option>
          </select>
        </label>
        <label className="field">
          <span>{labels.episodeCount}</span>
          <input value={episodeCount} onChange={(event) => onEpisodeCountChange(Number(event.target.value))} type="number" min={1} max={20} />
        </label>
        <label className="field">
          <span>{labels.episodeDuration}</span>
          <select value={episodeDuration} onChange={(event) => onEpisodeDurationChange(event.target.value)}>
            <option value="1:00-1:30">1:00-1:30</option>
            <option value="1:30-2:00">1:30-2:00</option>
            <option value="2:00-3:00">2:00-3:00</option>
          </select>
        </label>
        <label className="field">
          <span>{labels.style}</span>
          <select value={style} onChange={(event) => onStyleChange(event.target.value)}>
            <option value="dramatic">dramatic</option>
            <option value="comedic">comedic</option>
            <option value="suspense">suspense</option>
          </select>
        </label>
      </div>
      <div className="action-row">
        <button type="button" className="secondary-button" onClick={onSaveSource} disabled={saving}>
          {labels.saveSource}
        </button>
        <button type="button" className="primary-button" onClick={onRunScript} disabled={runningKind === 'script' || !sourceText.trim()}>
          {labels.generateScript}
        </button>
        <button type="button" className="secondary-button" onClick={onRunPipeline} disabled={runningKind === 'pipeline' || !sourceText.trim()}>
          {pipelineActionLabel ?? labels.generateStoryboard}
        </button>
      </div>
      {message ? <p className="helper-text">{message}</p> : null}
    </article>
  );
}

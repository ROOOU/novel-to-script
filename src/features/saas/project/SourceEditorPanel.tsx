'use client';

import { useRef } from 'react';
import {
  GENRE_LABELS,
  GENRE_LABELS_EN,
  GENRE_VALUES,
  type Genre,
  SCRIPT_STYLE_LABELS,
  SCRIPT_STYLE_LABELS_EN,
  SCRIPT_STYLE_VALUES,
  type EpisodeDuration,
  type ScriptStyle,
} from '@/lib/types';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface SourceEditorPanelProps {
  locale: SupportedLocale;
  labels: {
    sourceTitle: string;
    sourceHint: string;
    uploadSource: string;
    uploadHint: string;
    saveSource: string;
    generateScript: string;
    generateStoryboard: string;
    sourceActionHint: string;
    sourceLabel: string;
    genre: string;
    episodeCount: string;
    episodeDuration: string;
    style: string;
  };
  sourceTitle: string;
  sourceText: string;
  genre: Genre;
  episodeCount: number;
  episodeDuration: EpisodeDuration;
  style: ScriptStyle;
  message: string | null;
  saving: boolean;
  uploading: boolean;
  uploadAccept: string;
  runningKind: string | null;
  pipelineActionLabel?: string;
  onSourceTitleChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
  onGenreChange: (value: Genre) => void;
  onEpisodeCountChange: (value: number) => void;
  onEpisodeDurationChange: (value: EpisodeDuration) => void;
  onStyleChange: (value: ScriptStyle) => void;
  onSaveSource: () => void;
  onUploadFile: (file: File) => Promise<void>;
  onRunScript: () => void;
  onRunPipeline: () => void;
}

export function SourceEditorPanel({
  locale,
  labels,
  sourceTitle,
  sourceText,
  genre,
  episodeCount,
  episodeDuration,
  style,
  message,
  saving,
  uploading,
  uploadAccept,
  runningKind,
  pipelineActionLabel,
  onSourceTitleChange,
  onSourceTextChange,
  onGenreChange,
  onEpisodeCountChange,
  onEpisodeDurationChange,
  onStyleChange,
  onSaveSource,
  onUploadFile,
  onRunScript,
  onRunPipeline,
}: SourceEditorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const disableEditorActions = saving || uploading;
  const genreLabels = locale === 'en-US' ? GENRE_LABELS_EN : GENRE_LABELS;
  const styleLabels = locale === 'en-US' ? SCRIPT_STYLE_LABELS_EN : SCRIPT_STYLE_LABELS;

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
      <div className="action-row">
        <input
          ref={fileInputRef}
          type="file"
          accept={uploadAccept}
          className="hidden-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) {
              return;
            }

            void onUploadFile(file);
          }}
        />
        <button
          type="button"
          className="secondary-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disableEditorActions}
        >
          {labels.uploadSource}
        </button>
      </div>
      <p className="helper-text">{labels.uploadHint}</p>
      <div className="form-grid">
        <label className="field">
          <span>{labels.genre}</span>
          <select value={genre} onChange={(event) => onGenreChange(event.target.value as Genre)}>
            {GENRE_VALUES.map((value) => (
              <option key={value} value={value}>
                {genreLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{labels.episodeCount}</span>
          <input value={episodeCount} onChange={(event) => onEpisodeCountChange(Number(event.target.value))} type="number" min={1} max={20} />
        </label>
        <label className="field">
          <span>{labels.episodeDuration}</span>
          <select
            value={episodeDuration}
            onChange={(event) => onEpisodeDurationChange(event.target.value as EpisodeDuration)}
          >
            <option value="1:00-1:30">1:00-1:30</option>
            <option value="1:30-2:00">1:30-2:00</option>
            <option value="2:00-3:00">2:00-3:00</option>
          </select>
        </label>
        <label className="field">
          <span>{labels.style}</span>
          <select value={style} onChange={(event) => onStyleChange(event.target.value as ScriptStyle)}>
            {SCRIPT_STYLE_VALUES.map((value) => (
              <option key={value} value={value}>
                {styleLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="helper-text">{labels.sourceActionHint}</p>
      <div className="action-row">
        <button type="button" className="secondary-button" onClick={onSaveSource} disabled={disableEditorActions}>
          {labels.saveSource}
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onRunScript}
          disabled={disableEditorActions || runningKind === 'script' || !sourceText.trim()}
        >
          {labels.generateScript}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onRunPipeline}
          disabled={disableEditorActions || runningKind === 'pipeline' || !sourceText.trim()}
        >
          {pipelineActionLabel ?? labels.generateStoryboard}
        </button>
      </div>
      {message ? <p className="helper-text">{message}</p> : null}
    </article>
  );
}

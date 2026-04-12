import type { OutlineEntry } from '@/lib/types';
import { createEmptyOutlineEntry, joinLines, splitLines } from '@/lib/artifact-editors';
import type { ProjectArtifactStudioPanelProps } from '../ProjectArtifactStudioPanel';

export function OutlineEditor({
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

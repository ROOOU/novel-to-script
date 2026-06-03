'use client';

import { useMemo, useState } from 'react';
import { WorkspaceListRow } from '@/components/WorkspaceUI';
import type { GenerationArtifact } from '@/server/shared/platform/domain';
import { summarizeVersionDiff } from '@/lib/version-summary';

interface ArtifactVersionPanelProps {
  title: string;
  emptyLabel: string;
  resetLabel: string;
  saveLabel: string;
  historyLabel: string;
  basedOnLabel: string;
  createdAtLabel: string;
  changedLinesLabel: string;
  characterDeltaLabel: string;
  artifacts: GenerationArtifact[];
  selectedArtifactId: string | null;
  onSelectArtifact: (artifactId: string) => void;
  onVersionSaved?: () => Promise<void> | void;
}

export function ArtifactVersionPanel({
  title,
  emptyLabel,
  resetLabel,
  saveLabel,
  historyLabel,
  basedOnLabel,
  createdAtLabel,
  changedLinesLabel,
  characterDeltaLabel,
  artifacts,
  selectedArtifactId,
  onSelectArtifact,
  onVersionSaved,
}: ArtifactVersionPanelProps) {
  const selectedArtifact =
    artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null;
  const [draftState, setDraftState] = useState(() => ({
    artifactId: selectedArtifact?.id ?? null,
    content: selectedArtifact?.content ?? '',
  }));
  const [saving, setSaving] = useState(false);

  const versionHistory = useMemo(() => {
    if (!selectedArtifact) {
      return [];
    }

    return artifacts
      .filter((artifact) => {
        if (selectedArtifact.versionGroupId || artifact.versionGroupId) {
          return (artifact.versionGroupId ?? artifact.id) === (selectedArtifact.versionGroupId ?? selectedArtifact.id);
        }
        return artifact.kind === selectedArtifact.kind;
      })
      .sort((left, right) => right.version - left.version);
  }, [artifacts, selectedArtifact]);

  const previousVersion = useMemo(() => {
    if (!selectedArtifact) {
      return null;
    }

    return (
      versionHistory
        .filter((artifact) => artifact.id !== selectedArtifact.id && artifact.version < selectedArtifact.version)
        .sort((left, right) => right.version - left.version)[0] ?? null
    );
  }, [selectedArtifact, versionHistory]);

  const diffSummary = useMemo(
    () => summarizeVersionDiff(previousVersion?.content, selectedArtifact?.content),
    [previousVersion?.content, selectedArtifact?.content]
  );
  const draftContent =
    draftState.artifactId === (selectedArtifact?.id ?? null)
      ? draftState.content
      : (selectedArtifact?.content ?? '');

  async function handleSaveVersion() {
    if (!selectedArtifact) {
      return;
    }

    setSaving(true);
    await fetch(`/api/artifacts/${selectedArtifact.id}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: selectedArtifact.title,
        content: draftContent,
      }),
    });
    setSaving(false);
    await onVersionSaved?.();
  }

  return (
    <article className="card stack-gap">
      <h2>{title}</h2>
      {artifacts.length === 0 ? (
        <p>{emptyLabel}</p>
      ) : (
        <div className="version-layout">
          <div className="version-list">
            {artifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={`version-item ${selectedArtifact?.id === artifact.id ? 'active' : ''}`}
                onClick={() => onSelectArtifact(artifact.id)}
              >
                <strong>{artifact.title}</strong>
                <span>{artifact.kind}</span>
                <small>v{artifact.version}</small>
              </button>
            ))}
          </div>
          {selectedArtifact ? (
            <div className="artifact-block">
              <WorkspaceListRow>
                <div>
                  <strong>{selectedArtifact.title}</strong>
                  <p>{selectedArtifact.kind}</p>
                </div>
                <span>v{selectedArtifact.version}</span>
              </WorkspaceListRow>
              <div className="artifact-meta-grid">
                <div className="artifact-meta-card">
                  <span>{historyLabel}</span>
                  <strong>{versionHistory.length}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{basedOnLabel}</span>
                  <strong>{previousVersion ? `v${previousVersion.version}` : 'v1'}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{changedLinesLabel}</span>
                  <strong>{diffSummary.changedLines}</strong>
                </div>
                <div className="artifact-meta-card">
                  <span>{characterDeltaLabel}</span>
                  <strong>{diffSummary.characterDelta >= 0 ? `+${diffSummary.characterDelta}` : diffSummary.characterDelta}</strong>
                </div>
              </div>
              <p className="artifact-timestamp">
                {createdAtLabel}: {new Date(selectedArtifact.createdAt).toLocaleString()}
              </p>
              <textarea
                className="artifact-editor"
                value={draftContent}
                onChange={(event) =>
                  setDraftState({
                    artifactId: selectedArtifact.id,
                    content: event.target.value,
                  })
                }
                rows={18}
              />
              <div className="action-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setDraftState({
                      artifactId: selectedArtifact.id,
                      content: selectedArtifact.content ?? '',
                    })
                  }
                >
                  {resetLabel}
                </button>
                <button type="button" className="primary-button" onClick={handleSaveVersion} disabled={saving}>
                  {saveLabel}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}

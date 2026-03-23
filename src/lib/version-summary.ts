export interface VersionDiffSummary {
  previousCharacters: number;
  currentCharacters: number;
  characterDelta: number;
  previousLines: number;
  currentLines: number;
  lineDelta: number;
  changedLines: number;
}

export function summarizeVersionDiff(
  previousContent: string | null | undefined,
  currentContent: string | null | undefined
): VersionDiffSummary {
  const previous = previousContent ?? '';
  const current = currentContent ?? '';
  const previousLines: string[] = previous.length === 0 ? [] : previous.split(/\r?\n/);
  const currentLines: string[] = current.length === 0 ? [] : current.split(/\r?\n/);
  const maxLines = Math.max(previousLines.length, currentLines.length);

  let changedLines = 0;
  for (let index = 0; index < maxLines; index += 1) {
    if ((previousLines[index] ?? '') !== (currentLines[index] ?? '')) {
      changedLines += 1;
    }
  }

  return {
    previousCharacters: previous.length,
    currentCharacters: current.length,
    characterDelta: current.length - previous.length,
    previousLines: previousLines.length,
    currentLines: currentLines.length,
    lineDelta: currentLines.length - previousLines.length,
    changedLines,
  };
}

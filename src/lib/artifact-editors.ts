import { parseJsonLike } from '@/lib/json-parser';
import type { NovelAnalysis, OutlineEntry } from '@/lib/types';

export type EditableArtifactKind = 'analysis' | 'outline' | 'script';

export interface ParsedArtifactDraft<T> {
  value: T | null;
  raw: string;
  error: string | null;
}

export function createEmptyAnalysisDraft(): NovelAnalysis {
  return {
    title: '',
    genre: 'urban',
    characters: [],
    plotSummary: '',
    keyConflicts: [],
    climaxPoints: [],
    emotionalBeats: [],
  };
}

export function createEmptyOutlineEntry(episodeNumber: number): OutlineEntry {
  return {
    episodeNumber,
    title: '',
    summary: '',
    keyEvents: [],
    hook: '',
  };
}

export function parseAnalysisDraft(rawContent?: string | null): ParsedArtifactDraft<NovelAnalysis> {
  const raw = rawContent ?? '';
  if (!raw.trim()) {
    return {
      value: createEmptyAnalysisDraft(),
      raw,
      error: null,
    };
  }

  const result = parseJsonLike<unknown>(raw);
  if (!result.ok) {
    return {
      value: createEmptyAnalysisDraft(),
      raw,
      error: result.error,
    };
  }

  const parsed = result.value;
  const analysis =
    isRecord(parsed) && isRecord(parsed.analysis)
      ? (parsed.analysis as unknown as NovelAnalysis)
      : (parsed as unknown as NovelAnalysis);
  return {
    value: normalizeAnalysisDraft(analysis),
    raw: JSON.stringify(normalizeAnalysisDraft(analysis), null, 2),
    error: null,
  };
}

export function serializeAnalysisDraft(draft: NovelAnalysis): string {
  return JSON.stringify(normalizeAnalysisDraft(draft), null, 2);
}

export function parseOutlineDraft(rawContent?: string | null): ParsedArtifactDraft<OutlineEntry[]> {
  const raw = rawContent ?? '';
  if (!raw.trim()) {
    return {
      value: [],
      raw,
      error: null,
    };
  }

  const result = parseJsonLike<unknown>(raw);
  if (!result.ok) {
    return {
      value: [],
      raw,
      error: result.error,
    };
  }

  const parsed = result.value;
  const entries = Array.isArray(parsed)
    ? (parsed as OutlineEntry[])
    : isRecord(parsed) && Array.isArray(parsed.episodes)
      ? (parsed.episodes as OutlineEntry[])
      : [];

  const normalized = normalizeOutlineDraft(entries);
  return {
    value: normalized,
    raw: JSON.stringify(normalized, null, 2),
    error: null,
  };
}

export function serializeOutlineDraft(entries: OutlineEntry[]): string {
  return JSON.stringify(normalizeOutlineDraft(entries), null, 2);
}

export function normalizeAnalysisDraft(draft: NovelAnalysis): NovelAnalysis {
  return {
    ...draft,
    title: draft.title ?? '',
    genre: draft.genre ?? 'urban',
    characters: Array.isArray(draft.characters)
      ? draft.characters.map((character) => ({
          name: character.name ?? '',
          description: character.description ?? '',
          personality: character.personality ?? '',
          speechStyle: character.speechStyle ?? '',
          relationships: Array.isArray(character.relationships) ? character.relationships : [],
        }))
      : [],
    plotSummary: draft.plotSummary ?? '',
    keyConflicts: Array.isArray(draft.keyConflicts) ? draft.keyConflicts : [],
    climaxPoints: Array.isArray(draft.climaxPoints) ? draft.climaxPoints : [],
    emotionalBeats: Array.isArray(draft.emotionalBeats) ? draft.emotionalBeats : [],
  };
}

export function normalizeOutlineDraft(entries: OutlineEntry[]): OutlineEntry[] {
  return entries
    .map((entry, index) => ({
      episodeNumber: typeof entry.episodeNumber === 'number' && Number.isFinite(entry.episodeNumber)
        ? entry.episodeNumber
        : index + 1,
      title: entry.title ?? '',
      summary: entry.summary ?? '',
      keyEvents: Array.isArray(entry.keyEvents) ? entry.keyEvents : [],
      hook: entry.hook ?? '',
    }))
    .sort((left, right) => left.episodeNumber - right.episodeNumber);
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function joinLines(lines: string[]): string {
  return lines.map((line) => line.trim()).filter(Boolean).join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

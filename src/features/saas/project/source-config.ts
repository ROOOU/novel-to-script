import {
  GENRE_VALUES,
  SCRIPT_STYLE_VALUES,
  type EpisodeDuration,
  type Genre,
  type ScriptStyle,
} from '@/lib/types';
import type { GenerationJob } from '@/server/shared/platform/domain';

export interface ProjectSourceDraftConfig {
  genre: Genre;
  episodeCount: number;
  episodeDuration: EpisodeDuration;
  style: ScriptStyle;
}

export const DEFAULT_PROJECT_SOURCE_DRAFT_CONFIG: ProjectSourceDraftConfig = {
  genre: 'urban',
  episodeCount: 5,
  episodeDuration: '1:30-2:00',
  style: 'dramatic',
};

export function deriveProjectSourceDraftConfig(input: {
  projectGenre?: string | null;
  jobs: GenerationJob[];
}): ProjectSourceDraftConfig {
  const latestJobConfig = findLatestScriptJobConfig(input.jobs);

  return {
    genre:
      latestJobConfig?.genre ??
      normalizeGenre(input.projectGenre) ??
      DEFAULT_PROJECT_SOURCE_DRAFT_CONFIG.genre,
    episodeCount:
      latestJobConfig?.episodeCount ?? DEFAULT_PROJECT_SOURCE_DRAFT_CONFIG.episodeCount,
    episodeDuration:
      latestJobConfig?.episodeDuration ??
      DEFAULT_PROJECT_SOURCE_DRAFT_CONFIG.episodeDuration,
    style: latestJobConfig?.style ?? DEFAULT_PROJECT_SOURCE_DRAFT_CONFIG.style,
  };
}

function findLatestScriptJobConfig(
  jobs: GenerationJob[]
): ProjectSourceDraftConfig | null {
  const sortedJobs = [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  for (const job of sortedJobs) {
    if (job.kind !== 'script-generation') {
      continue;
    }

    const config = parseSourceDraftConfig(job.inputSnapshot);
    if (config) {
      return config;
    }
  }

  return null;
}

function parseSourceDraftConfig(
  inputSnapshot: Record<string, unknown>
): ProjectSourceDraftConfig | null {
  const payload = isRecord(inputSnapshot.payload) ? inputSnapshot.payload : null;
  const config = payload && isRecord(payload.config) ? payload.config : null;
  if (!config) {
    return null;
  }

  const genre = normalizeGenre(config.genre);
  const episodeCount = normalizeEpisodeCount(config.episodeCount);
  const episodeDuration = normalizeEpisodeDuration(config.episodeDuration);
  const style = normalizeStyle(config.style);

  if (!genre || !episodeCount || !episodeDuration || !style) {
    return null;
  }

  return {
    genre,
    episodeCount,
    episodeDuration,
    style,
  };
}

function normalizeGenre(value: unknown): Genre | null {
  return typeof value === 'string' && GENRE_VALUES.includes(value as Genre)
    ? (value as Genre)
    : null;
}

function normalizeEpisodeCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20
    ? value
    : null;
}

function normalizeEpisodeDuration(value: unknown): EpisodeDuration | null {
  return value === '1:00-1:30' || value === '1:30-2:00' || value === '2:00-3:00'
    ? value
    : null;
}

function normalizeStyle(value: unknown): ScriptStyle | null {
  return typeof value === 'string' && SCRIPT_STYLE_VALUES.includes(value as ScriptStyle)
    ? (value as ScriptStyle)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

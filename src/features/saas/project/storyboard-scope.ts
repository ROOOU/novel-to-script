import type { StoryboardGenerateRequestV2 } from '@/features/storyboard/contracts';
import type { GenerationArtifact } from '@/server/shared/platform/domain';

export interface StoryboardScopeSourceOption {
  artifactId: string;
  title: string;
  version: number;
  episodeNumber: number | null;
  createdAt: string;
  sceneOptions: StoryboardScopeSceneOption[];
}

export interface StoryboardScopeSceneOption {
  artifactId: string;
  id: string;
  heading: string;
  episodeNumber: number | null;
}

interface BuildStoryboardGenerationPayloadInput {
  artifactIds: string[];
  episodeNumbers: number[];
  sceneIds: string[];
}

export function deriveStoryboardScopeSourceOptions(
  artifacts: GenerationArtifact[]
): StoryboardScopeSourceOption[] {
  return artifacts
    .filter((artifact) => artifact.kind === 'script')
    .toSorted(sortArtifactsByRecency)
    .map((artifact) => ({
      artifactId: artifact.id,
      title: artifact.title,
      version: artifact.version,
      episodeNumber: readEpisodeNumber(artifact),
      createdAt: artifact.createdAt,
      sceneOptions: extractSceneOptions(artifact),
    }));
}

export function deriveDefaultStoryboardSourceArtifactIds(
  sourceOptions: StoryboardScopeSourceOption[]
): string[] {
  const latestByEpisode = new Map<number, string>();
  const fallbackArtifactIds: string[] = [];

  for (const option of sourceOptions) {
    if (typeof option.episodeNumber === 'number') {
      if (!latestByEpisode.has(option.episodeNumber)) {
        latestByEpisode.set(option.episodeNumber, option.artifactId);
      }
      continue;
    }

    if (fallbackArtifactIds.length === 0) {
      fallbackArtifactIds.push(option.artifactId);
    }
  }

  return latestByEpisode.size > 0
    ? Array.from(latestByEpisode.values())
    : fallbackArtifactIds;
}

export function deriveStoryboardScopeEpisodeOptions(
  sourceOptions: StoryboardScopeSourceOption[],
  selectedArtifactIds: string[]
): number[] {
  const selectedArtifactIdSet = new Set(selectedArtifactIds);
  const relevantOptions =
    selectedArtifactIdSet.size > 0
      ? sourceOptions.filter((option) => selectedArtifactIdSet.has(option.artifactId))
      : sourceOptions;

  return relevantOptions
    .map((option) => option.episodeNumber)
    .filter((episodeNumber): episodeNumber is number => typeof episodeNumber === 'number')
    .toSorted((left, right) => left - right)
    .filter((episodeNumber, index, values) => values.indexOf(episodeNumber) === index);
}

export function deriveStoryboardScopeSceneOptions(
  sourceOptions: StoryboardScopeSourceOption[],
  selectedArtifactIds: string[]
): StoryboardScopeSceneOption[] {
  const selectedArtifactIdSet = new Set(selectedArtifactIds);
  const relevantOptions =
    selectedArtifactIdSet.size > 0
      ? sourceOptions.filter((option) => selectedArtifactIdSet.has(option.artifactId))
      : sourceOptions;
  const seenKeys = new Set<string>();
  const sceneOptions: StoryboardScopeSceneOption[] = [];

  for (const option of relevantOptions) {
    for (const scene of option.sceneOptions) {
      const sceneKey = `${scene.artifactId}:${scene.id}`;
      if (seenKeys.has(sceneKey)) {
        continue;
      }
      seenKeys.add(sceneKey);
      sceneOptions.push(scene);
    }
  }

  return sceneOptions;
}

export function buildStoryboardGenerationPayload({
  artifactIds,
  episodeNumbers,
  sceneIds,
}: BuildStoryboardGenerationPayloadInput): Pick<
  StoryboardGenerateRequestV2,
  'scope' | 'selection' | 'scriptArtifactIds'
> {
  const normalizedArtifactIds = normalizeArtifactIds(artifactIds);
  const normalizedEpisodeNumbers = normalizeEpisodeNumbers(episodeNumbers);
  const normalizedSceneIds = normalizeSceneIds(sceneIds);
  const hasSelectionFilters =
    normalizedEpisodeNumbers.length > 0 || normalizedSceneIds.length > 0;

  if (!hasSelectionFilters) {
    return {
      scriptArtifactIds: normalizedArtifactIds,
    };
  }

  return {
    scope: 'selection',
    scriptArtifactIds: normalizedArtifactIds,
    selection: {
      artifactIds: [],
      episodeNumbers: normalizedEpisodeNumbers,
      sceneIds: normalizedSceneIds,
    },
  };
}

function sortArtifactsByRecency(left: GenerationArtifact, right: GenerationArtifact) {
  return right.createdAt.localeCompare(left.createdAt) || right.version - left.version;
}

function normalizeArtifactIds(artifactIds: string[]): string[] {
  return Array.from(
    new Set(
      artifactIds
        .map((artifactId) => artifactId.trim())
        .filter((artifactId) => artifactId.length > 0)
    )
  );
}

function normalizeEpisodeNumbers(episodeNumbers: number[]): number[] {
  return Array.from(
    new Set(
      episodeNumbers.filter(
        (episodeNumber): episodeNumber is number =>
          Number.isInteger(episodeNumber) && episodeNumber > 0
      )
    )
  ).toSorted((left, right) => left - right);
}

function normalizeSceneIds(sceneIds: string[]): string[] {
  return Array.from(
    new Set(
      sceneIds
        .map((sceneId) => sceneId.trim())
        .filter((sceneId) => sceneId.length > 0)
    )
  );
}

function readEpisodeNumber(artifact: GenerationArtifact): number | null {
  const episode = artifact.metadata?.episode;
  return typeof episode === 'number' && Number.isInteger(episode) && episode > 0
    ? episode
    : null;
}

function extractSceneOptions(artifact: GenerationArtifact): StoryboardScopeSceneOption[] {
  const content = artifact.content?.trim() ?? '';
  if (!content) {
    return [];
  }

  const sceneHeadingPattern =
    /^\s*(\d+-\d+)\s+(?:日|夜|晨|暮|黄昏)\s*(?:内|外|内外)\s*.+$/gm;
  const matches = Array.from(content.matchAll(sceneHeadingPattern));
  const seenSceneIds = new Set<string>();
  const sceneOptions: StoryboardScopeSceneOption[] = [];

  for (const match of matches) {
    const sceneId = match[1]?.trim();
    const heading = match[0]?.trim();
    if (!sceneId || !heading || seenSceneIds.has(sceneId)) {
      continue;
    }

    seenSceneIds.add(sceneId);
    sceneOptions.push({
      artifactId: artifact.id,
      id: sceneId,
      heading,
      episodeNumber: readEpisodeNumber(artifact),
    });
  }

  return sceneOptions;
}

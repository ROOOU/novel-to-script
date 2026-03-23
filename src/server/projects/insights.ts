import { parseJsonLike } from '@/lib/json-parser';
import type { NovelAnalysis, OutlineEntry } from '@/lib/types';
import type { GenerationArtifact } from '@/server/shared/platform/domain';

export interface ProjectArtifactCollectionSummary {
  kind: GenerationArtifact['kind'];
  count: number;
  latestArtifactId: string | null;
  latestVersion: number | null;
  latestTitle: string | null;
}

export interface StructuredArtifactSnapshot<TValue> {
  artifactId: string;
  title: string;
  version: number;
  rawContent: string;
  parsed: TValue | null;
  parseError: string | null;
}

export interface ProjectArtifactInsights {
  collections: ProjectArtifactCollectionSummary[];
  latestAnalysis: StructuredArtifactSnapshot<NovelAnalysis> | null;
  latestOutline: StructuredArtifactSnapshot<OutlineEntry[]> | null;
}

export function buildProjectArtifactInsights(
  artifacts: GenerationArtifact[]
): ProjectArtifactInsights {
  const collections = buildArtifactCollections(artifacts);

  return {
    collections,
    latestAnalysis: buildStructuredSnapshot<NovelAnalysis>(artifacts, 'analysis'),
    latestOutline: buildStructuredSnapshot<OutlineEntry[]>(artifacts, 'outline'),
  };
}

function buildArtifactCollections(artifacts: GenerationArtifact[]): ProjectArtifactCollectionSummary[] {
  const byKind = new Map<
    GenerationArtifact['kind'],
    { count: number; latest: GenerationArtifact | null }
  >();

  for (const artifact of artifacts) {
    const current = byKind.get(artifact.kind);
    if (!current) {
      byKind.set(artifact.kind, { count: 1, latest: artifact });
      continue;
    }

    current.count += 1;
    if (!current.latest || isArtifactNewer(artifact, current.latest)) {
      current.latest = artifact;
    }
  }

  return Array.from(byKind.entries())
    .map(([kind, summary]) => ({
      kind,
      count: summary.count,
      latestArtifactId: summary.latest?.id ?? null,
      latestVersion: summary.latest?.version ?? null,
      latestTitle: summary.latest?.title ?? null,
    }))
    .sort((left, right) => left.kind.localeCompare(right.kind));
}

function buildStructuredSnapshot<TValue>(
  artifacts: GenerationArtifact[],
  kind: GenerationArtifact['kind']
): StructuredArtifactSnapshot<TValue> | null {
  const artifact = artifacts
    .filter((entry) => entry.kind === kind && typeof entry.content === 'string' && entry.content.trim())
    .sort(compareArtifacts)[0];

  if (!artifact || !artifact.content) {
    return null;
  }

  const parsed = parseJsonLike<TValue>(artifact.content);
  return {
    artifactId: artifact.id,
    title: artifact.title,
    version: artifact.version,
    rawContent: artifact.content,
    parsed: parsed.ok ? parsed.value : null,
    parseError: parsed.ok ? null : parsed.error,
  };
}

function isArtifactNewer(left: GenerationArtifact, right: GenerationArtifact) {
  return compareArtifacts(left, right) < 0;
}

function compareArtifacts(left: GenerationArtifact, right: GenerationArtifact) {
  if (left.version !== right.version) {
    return right.version - left.version;
  }

  return right.createdAt.localeCompare(left.createdAt);
}

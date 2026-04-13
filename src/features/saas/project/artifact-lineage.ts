import type {
  ArtifactRelation,
  ArtifactRelationType,
  GenerationArtifact,
  GenerationArtifactKind,
} from '@/server/shared/platform/domain';

type RelationLabel = ArtifactRelationType | 'metadata';

export interface ArtifactLineageReference {
  artifactId: string;
  artifact: GenerationArtifact | null;
  relationType: RelationLabel;
  depth: number;
}

export interface ArtifactLineageSummaryItem {
  kind: GenerationArtifactKind;
  artifacts: GenerationArtifact[];
  count: number;
}

export interface ArtifactLineage {
  directUpstream: ArtifactLineageReference[];
  directDownstream: ArtifactLineageReference[];
  upstream: ArtifactLineageReference[];
  downstream: ArtifactLineageReference[];
  chainArtifacts: GenerationArtifact[];
  stageCounts: ArtifactLineageSummaryItem[];
}

const KIND_ORDER: GenerationArtifactKind[] = [
  'analysis',
  'story_bible',
  'scene_cards',
  'outline',
  'script',
  'storyboard',
  'shot_plan',
  'prompt_pack',
  'export',
  'prompt',
];

export function deriveArtifactLineage(
  selectedArtifact: GenerationArtifact,
  artifacts: GenerationArtifact[],
  relations: ArtifactRelation[]
): ArtifactLineage {
  const graph = createArtifactGraph(artifacts, relations);
  const directUpstream = sortReferences(collectDirectUpstream(selectedArtifact, graph));
  const directDownstream = sortReferences(
    collectReferences(selectedArtifact.id, graph.relationsByUpstream, graph.artifactById, 'downstream', 1)
  );
  const upstream = sortReferences(
    collectRecursiveReferences(directUpstream, graph.relationsByDownstream, graph.artifactById, 'upstream')
  );
  const downstream = sortReferences(
    collectRecursiveReferences(directDownstream, graph.relationsByUpstream, graph.artifactById, 'downstream')
  );
  const chainArtifacts = sortArtifacts(
    uniqueArtifacts([
      selectedArtifact,
      ...upstream.flatMap((entry) => (entry.artifact ? [entry.artifact] : [])),
      ...downstream.flatMap((entry) => (entry.artifact ? [entry.artifact] : [])),
    ])
  );

  return {
    directUpstream,
    directDownstream,
    upstream,
    downstream,
    chainArtifacts,
    stageCounts: KIND_ORDER.map((kind) => {
      const scopedArtifacts = chainArtifacts.filter((artifact) => artifact.kind === kind);
      return {
        kind,
        artifacts: scopedArtifacts,
        count: scopedArtifacts.length,
      };
    }),
  };
}

export function collectArtifactIdsFromMetadata(metadata?: Record<string, unknown> | null): string[] {
  if (!metadata) {
    return [];
  }

  const rawValues = [
    metadata.sourceScriptArtifactIds,
    metadata.sourceArtifactIds,
    metadata.upstreamArtifactIds,
    metadata.sourceArtifactId,
  ];

  return Array.from(new Set(rawValues.flatMap((value) => normalizeArtifactIdValue(value))));
}

function createArtifactGraph(artifacts: GenerationArtifact[], relations: ArtifactRelation[]) {
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const relationsByUpstream = new Map<string, ArtifactRelation[]>();
  const relationsByDownstream = new Map<string, ArtifactRelation[]>();

  for (const relation of relations) {
    const downstreamBucket = relationsByDownstream.get(relation.downstreamArtifactId) ?? [];
    downstreamBucket.push(relation);
    relationsByDownstream.set(relation.downstreamArtifactId, downstreamBucket);

    const upstreamBucket = relationsByUpstream.get(relation.upstreamArtifactId) ?? [];
    upstreamBucket.push(relation);
    relationsByUpstream.set(relation.upstreamArtifactId, upstreamBucket);
  }

  return {
    artifactById,
    relationsByUpstream,
    relationsByDownstream,
  };
}

function collectDirectUpstream(
  selectedArtifact: GenerationArtifact,
  graph: ReturnType<typeof createArtifactGraph>
) {
  const references = collectReferences(
    selectedArtifact.id,
    graph.relationsByDownstream,
    graph.artifactById,
    'upstream',
    1
  );
  const referencesById = new Map(references.map((entry) => [entry.artifactId, entry]));

  for (const artifactId of collectArtifactIdsFromMetadata(selectedArtifact.metadata)) {
    if (referencesById.has(artifactId)) {
      continue;
    }

    referencesById.set(artifactId, {
      artifactId,
      artifact: graph.artifactById.get(artifactId) ?? null,
      relationType: 'metadata',
      depth: 1,
    });
  }

  return [...referencesById.values()];
}

function collectRecursiveReferences(
  initialReferences: ArtifactLineageReference[],
  relationMap: Map<string, ArtifactRelation[]>,
  artifactById: Map<string, GenerationArtifact>,
  direction: 'upstream' | 'downstream'
) {
  const queue = [...initialReferences];
  const seen = new Map<string, ArtifactLineageReference>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const existing = seen.get(current.artifactId);
    if (existing && !shouldReplaceReference(existing, current)) {
      continue;
    }

    seen.set(current.artifactId, current);

    for (const nextReference of collectReferences(
      current.artifactId,
      relationMap,
      artifactById,
      direction,
      current.depth + 1
    )) {
      const existingNext = seen.get(nextReference.artifactId);
      if (!existingNext || shouldReplaceReference(existingNext, nextReference)) {
        queue.push(nextReference);
      }
    }
  }

  return [...seen.values()];
}

function collectReferences(
  artifactId: string,
  relationMap: Map<string, ArtifactRelation[]>,
  artifactById: Map<string, GenerationArtifact>,
  direction: 'upstream' | 'downstream',
  depth: number
) {
  const referencesById = new Map<string, ArtifactLineageReference>();

  for (const relation of relationMap.get(artifactId) ?? []) {
    const relatedArtifactId =
      direction === 'upstream' ? relation.upstreamArtifactId : relation.downstreamArtifactId;
    referencesById.set(relatedArtifactId, {
      artifactId: relatedArtifactId,
      artifact: artifactById.get(relatedArtifactId) ?? null,
      relationType: relation.relationType,
      depth,
    });
  }

  return [...referencesById.values()];
}

function shouldReplaceReference(
  existing: ArtifactLineageReference,
  candidate: ArtifactLineageReference
) {
  if (existing.depth !== candidate.depth) {
    return candidate.depth < existing.depth;
  }

  if (existing.relationType === 'metadata' && candidate.relationType !== 'metadata') {
    return true;
  }

  return false;
}

function sortReferences(references: ArtifactLineageReference[]) {
  return [...references].sort((left, right) => {
    const kindDelta = compareArtifactKinds(left.artifact?.kind, right.artifact?.kind);
    if (kindDelta !== 0) {
      return kindDelta;
    }

    const depthDelta = left.depth - right.depth;
    if (depthDelta !== 0) {
      return depthDelta;
    }

    const createdAtDelta = compareNullableStrings(left.artifact?.createdAt, right.artifact?.createdAt);
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    const versionDelta =
      (left.artifact?.version ?? Number.MAX_SAFE_INTEGER) -
      (right.artifact?.version ?? Number.MAX_SAFE_INTEGER);
    if (versionDelta !== 0) {
      return versionDelta;
    }

    return left.artifactId.localeCompare(right.artifactId);
  });
}

function sortArtifacts(artifacts: GenerationArtifact[]) {
  return [...artifacts].sort((left, right) => {
    const kindDelta = compareArtifactKinds(left.kind, right.kind);
    if (kindDelta !== 0) {
      return kindDelta;
    }

    const createdAtDelta = left.createdAt.localeCompare(right.createdAt);
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    const versionDelta = left.version - right.version;
    if (versionDelta !== 0) {
      return versionDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function uniqueArtifacts(artifacts: GenerationArtifact[]) {
  const map = new Map<string, GenerationArtifact>();
  for (const artifact of artifacts) {
    map.set(artifact.id, artifact);
  }
  return [...map.values()];
}

function compareArtifactKinds(
  left?: GenerationArtifactKind | null,
  right?: GenerationArtifactKind | null
) {
  const leftIndex = left ? KIND_ORDER.indexOf(left) : -1;
  const rightIndex = right ? KIND_ORDER.indexOf(right) : -1;
  return normalizeKindIndex(leftIndex) - normalizeKindIndex(rightIndex);
}

function normalizeKindIndex(index: number) {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function compareNullableStrings(left?: string | null, right?: string | null) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left.localeCompare(right);
}

function normalizeArtifactIdValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeArtifactIdValue(item));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

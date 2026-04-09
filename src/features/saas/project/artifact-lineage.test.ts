import { describe, expect, it } from 'vitest';
import type {
  ArtifactRelation,
  GenerationArtifact,
} from '@/server/shared/platform/domain';
import {
  collectArtifactIdsFromMetadata,
  deriveArtifactLineage,
} from '@/features/saas/project/artifact-lineage';

describe('artifact-lineage', () => {
  it('builds a recursive upstream chain ordered by production stage', () => {
    const artifacts = [
      createArtifact({ id: 'analysis_1', kind: 'analysis', title: 'Analysis' }),
      createArtifact({ id: 'outline_1', kind: 'outline', title: 'Outline' }),
      createArtifact({ id: 'script_1', kind: 'script', title: 'Script' }),
      createArtifact({ id: 'story_1', kind: 'storyboard', title: 'Storyboard' }),
    ];
    const relations = [
      createRelation({ upstreamArtifactId: 'analysis_1', downstreamArtifactId: 'outline_1' }),
      createRelation({ upstreamArtifactId: 'outline_1', downstreamArtifactId: 'script_1' }),
      createRelation({ upstreamArtifactId: 'script_1', downstreamArtifactId: 'story_1' }),
    ];

    const lineage = deriveArtifactLineage(artifacts[3], artifacts, relations);

    expect(lineage.upstream.map((entry) => entry.artifactId)).toEqual([
      'analysis_1',
      'outline_1',
      'script_1',
    ]);
    expect(lineage.chainArtifacts.map((artifact) => artifact.id)).toEqual([
      'analysis_1',
      'outline_1',
      'script_1',
      'story_1',
    ]);
  });

  it('deduplicates metadata fallbacks when real relations exist', () => {
    const script = createArtifact({ id: 'script_1', kind: 'script' });
    const storyboard = createArtifact({
      id: 'story_1',
      kind: 'storyboard',
      metadata: {
        sourceScriptArtifactIds: ['script_1'],
        sourceArtifactIds: ['script_1'],
      },
    });
    const lineage = deriveArtifactLineage(storyboard, [script, storyboard], [
      createRelation({ upstreamArtifactId: 'script_1', downstreamArtifactId: 'story_1' }),
    ]);

    expect(lineage.directUpstream).toHaveLength(1);
    expect(lineage.directUpstream[0]).toMatchObject({
      artifactId: 'script_1',
      relationType: 'derived_from',
    });
  });

  it('falls back to metadata for historical artifacts without relation rows', () => {
    const script = createArtifact({ id: 'script_1', kind: 'script' });
    const storyboard = createArtifact({
      id: 'story_1',
      kind: 'storyboard',
      metadata: {
        sourceScriptArtifactIds: ['script_1'],
      },
    });

    const lineage = deriveArtifactLineage(storyboard, [script, storyboard], []);

    expect(lineage.directUpstream).toMatchObject([
      {
        artifactId: 'script_1',
        relationType: 'metadata',
      },
    ]);
  });

  it('scopes stage counts to the selected artifact lineage instead of the whole project', () => {
    const artifacts = [
      createArtifact({ id: 'analysis_a', kind: 'analysis' }),
      createArtifact({ id: 'outline_a', kind: 'outline' }),
      createArtifact({ id: 'script_a', kind: 'script' }),
      createArtifact({ id: 'story_a', kind: 'storyboard' }),
      createArtifact({ id: 'script_b', kind: 'script' }),
      createArtifact({ id: 'story_b', kind: 'storyboard' }),
    ];
    const relations = [
      createRelation({ upstreamArtifactId: 'analysis_a', downstreamArtifactId: 'outline_a' }),
      createRelation({ upstreamArtifactId: 'outline_a', downstreamArtifactId: 'script_a' }),
      createRelation({ upstreamArtifactId: 'script_a', downstreamArtifactId: 'story_a' }),
      createRelation({ upstreamArtifactId: 'script_b', downstreamArtifactId: 'story_b' }),
    ];

    const lineage = deriveArtifactLineage(artifacts[3], artifacts, relations);

    expect(lineage.stageCounts.find((item) => item.kind === 'analysis')?.count).toBe(1);
    expect(lineage.stageCounts.find((item) => item.kind === 'script')?.count).toBe(1);
    expect(lineage.stageCounts.find((item) => item.kind === 'storyboard')?.count).toBe(1);
  });

  it('collects known metadata source keys without duplicate ids', () => {
    expect(
      collectArtifactIdsFromMetadata({
        sourceScriptArtifactIds: ['script_1'],
        sourceArtifactIds: ['script_1', 'outline_1'],
        upstreamArtifactIds: ['outline_1', 'analysis_1'],
        sourceArtifactId: 'analysis_1',
      })
    ).toEqual(['script_1', 'outline_1', 'analysis_1']);
  });
});

function createArtifact(overrides: Partial<GenerationArtifact>): GenerationArtifact {
  return {
    id: 'artifact_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    sourceDocumentId: null,
    generationJobId: 'job_1',
    kind: 'script',
    format: 'text/plain',
    title: 'Artifact',
    content: 'body',
    version: 1,
    versionGroupId: null,
    parentArtifactId: null,
    metadata: {},
    isEditable: true,
    createdByUserId: 'user_1',
    updatedByUserId: 'user_1',
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  } as GenerationArtifact;
}

function createRelation(overrides: Partial<ArtifactRelation>): ArtifactRelation {
  return {
    id: 'relation_1',
    projectId: 'proj_1',
    upstreamArtifactId: 'script_1',
    downstreamArtifactId: 'story_1',
    relationType: 'derived_from',
    metadata: {},
    createdByUserId: 'user_1',
    updatedByUserId: 'user_1',
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  } as ArtifactRelation;
}

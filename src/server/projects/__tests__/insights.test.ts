import { describe, expect, it } from 'vitest';
import { buildProjectArtifactInsights } from '@/server/projects/insights';
import type { GenerationArtifact } from '@/server/shared/platform/domain';

function createArtifact(overrides: Partial<GenerationArtifact>): GenerationArtifact {
  return {
    id: 'artifact_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    generationJobId: 'job_1',
    kind: 'script',
    format: 'text/plain',
    title: 'Artifact',
    version: 1,
    content: 'content',
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: '2026-03-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildProjectArtifactInsights', () => {
  it('summarizes collections and parses latest structured artifacts', () => {
    const insights = buildProjectArtifactInsights([
      createArtifact({
        id: 'analysis_old',
        kind: 'analysis',
        format: 'application/json',
        title: 'Analysis v1',
        version: 1,
        content: '{"title":"Old","genre":"urban","characters":[],"plotSummary":"old","keyConflicts":[],"climaxPoints":[],"emotionalBeats":[]}',
      }),
      createArtifact({
        id: 'analysis_new',
        kind: 'analysis',
        format: 'application/json',
        title: 'Analysis v2',
        version: 2,
        content: '{"title":"New","genre":"urban","characters":[],"plotSummary":"new","keyConflicts":[],"climaxPoints":[],"emotionalBeats":[]}',
      }),
      createArtifact({
        id: 'outline_1',
        kind: 'outline',
        format: 'application/json',
        title: 'Outline v1',
        version: 1,
        content: '[{"episodeNumber":1,"title":"EP1","summary":"s","keyEvents":["a"],"hook":"h"}]',
      }),
    ]);

    expect(insights.collections).toEqual([
      {
        kind: 'analysis',
        count: 2,
        latestArtifactId: 'analysis_new',
        latestVersion: 2,
        latestTitle: 'Analysis v2',
      },
      {
        kind: 'outline',
        count: 1,
        latestArtifactId: 'outline_1',
        latestVersion: 1,
        latestTitle: 'Outline v1',
      },
    ]);
    expect(insights.latestAnalysis?.artifactId).toBe('analysis_new');
    expect(insights.latestAnalysis?.parsed?.title).toBe('New');
    expect(insights.latestOutline?.parsed?.[0]?.title).toBe('EP1');
  });
});

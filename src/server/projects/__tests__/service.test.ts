import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactRelation } from '@/server/shared/platform/domain';

const getPlatformRuntimeMock = vi.fn();

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => getPlatformRuntimeMock(),
}));

import { getProjectBundle } from '@/server/projects/service';

describe('getProjectBundle', () => {
  beforeEach(() => {
    getPlatformRuntimeMock.mockReset();
  });

  it('includes artifact relations in the bundle', async () => {
    getPlatformRuntimeMock.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'proj_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
          slug: 'sample-project',
          name: 'Sample Project',
          status: 'active',
          createdAt: '2026-03-23T00:00:00.000Z',
          updatedAt: '2026-03-23T00:00:00.000Z',
        }),
      },
      sourceDocuments: {
        listByProjectId: vi.fn().mockResolvedValue([]),
      },
      generationJobs: {
        listByProjectId: vi.fn().mockResolvedValue([]),
      },
      generationArtifacts: {
        listByProjectId: vi.fn().mockResolvedValue([
          {
            id: 'artifact_1',
            organizationId: 'org_1',
            workspaceId: 'ws_1',
            projectId: 'proj_1',
            generationJobId: 'job_1',
            kind: 'script',
            format: 'text/plain',
            title: 'Episode 1',
            version: 1,
            content: 'script content',
            createdAt: '2026-03-23T00:00:00.000Z',
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
        ]),
      },
      artifactRelations: {
        listByProjectId: vi.fn().mockResolvedValue([
          {
            id: 'relation_old',
            projectId: 'proj_1',
            upstreamArtifactId: 'artifact_0',
            downstreamArtifactId: 'artifact_1',
            relationType: 'derived_from',
            createdAt: '2026-03-23T00:00:00.000Z',
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
          {
            id: 'relation_new',
            projectId: 'proj_1',
            upstreamArtifactId: 'artifact_1',
            downstreamArtifactId: 'artifact_2',
            relationType: 'derived_from',
            createdAt: '2026-03-24T00:00:00.000Z',
            updatedAt: '2026-03-24T00:00:00.000Z',
          },
        ]),
      },
    });

    const bundle = await getProjectBundle('proj_1');

    expect(bundle?.artifactRelations.map((relation: ArtifactRelation) => relation.id)).toEqual(['relation_new', 'relation_old']);
    expect(bundle?.artifacts).toHaveLength(1);
    expect(bundle?.insights.collections).toHaveLength(1);
  });
});

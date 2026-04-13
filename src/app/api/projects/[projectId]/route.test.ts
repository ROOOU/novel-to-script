import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  getProjectBundle: vi.fn(),
  archiveProject: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/projects/service', () => ({
  getProjectBundle: (...args: unknown[]) => mocks.getProjectBundle(...args),
  archiveProject: (...args: unknown[]) => mocks.archiveProject(...args),
}));

import { DELETE, GET } from '@/app/api/projects/[projectId]/route';

describe('project bundle route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerResponse.mockResolvedValue({
      viewer: {
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
        user: { id: 'user_1' },
      },
      response: null,
    });
    mocks.getProjectBundle.mockResolvedValue(null);
    mocks.archiveProject.mockResolvedValue({
      id: 'proj_1',
      status: 'archived',
    });
  });

  it('rejects unauthenticated requests', async () => {
    const responseMarker = new Response(null, { status: 401 });
    mocks.requireViewerResponse.mockResolvedValueOnce({
      viewer: null,
      response: responseMarker,
    });

    const response = await GET(new Request('https://app.test/api/projects/proj_1'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(response).toBe(responseMarker);
  });

  it('returns 404 when no bundle is found', async () => {
    const response = await GET(new Request('https://app.test/api/projects/proj_1'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
  });

  it('returns 404 when the bundle belongs to a different workspace', async () => {
    mocks.getProjectBundle.mockResolvedValue({
      project: {
        id: 'proj_1',
        organizationId: 'org_1',
        workspaceId: 'ws_other',
      },
      sourceDocuments: [],
      jobs: [],
      artifacts: [],
      artifactRelations: [],
      insights: { collections: [] },
    });

    const response = await GET(new Request('https://app.test/api/projects/proj_1'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
  });

  it('returns the project bundle including artifact relations', async () => {
    mocks.getProjectBundle.mockResolvedValue({
      project: {
        id: 'proj_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
      },
      sourceDocuments: [{ id: 'source_1' }],
      jobs: [{ id: 'job_1' }],
      artifacts: [{ id: 'artifact_1' }],
      artifactRelations: [
        {
          id: 'relation_1',
          projectId: 'proj_1',
          upstreamArtifactId: 'artifact_0',
          downstreamArtifactId: 'artifact_1',
          relationType: 'derived_from',
        },
      ],
      insights: { collections: [{ kind: 'script', count: 1 }] },
    });

    const response = await GET(new Request('https://app.test/api/projects/proj_1'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      project: { id: 'proj_1' },
      artifactRelations: [
        {
          id: 'relation_1',
          projectId: 'proj_1',
        },
      ],
    });
    expect(mocks.getProjectBundle).toHaveBeenCalledWith('proj_1');
  });

  it('archives a project for the active viewer', async () => {
    const response = await DELETE(new Request('https://app.test/api/projects/proj_1', {
      method: 'DELETE',
    }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(mocks.archiveProject).toHaveBeenCalledWith({
      projectId: 'proj_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      userId: 'user_1',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      project: {
        id: 'proj_1',
        status: 'archived',
      },
    });
  });

  it('returns 404 when archive target is missing', async () => {
    mocks.archiveProject.mockRejectedValueOnce(new Error('PROJECT_NOT_FOUND'));

    const response = await DELETE(new Request('https://app.test/api/projects/proj_1', {
      method: 'DELETE',
    }), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
  });
});

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  getPlatformRuntime: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

import { POST } from '@/app/api/artifacts/[artifactId]/versions/route';

describe('artifact versions route', () => {
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
    mocks.getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById: vi.fn().mockResolvedValue({
          id: 'artifact_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
          projectId: 'proj_1',
          generationJobId: 'job_1',
          sourceDocumentId: 'source_1',
          kind: 'script',
          format: 'text/plain',
          title: '第1集剧本',
          version: 1,
          versionGroupId: 'artifact_1',
          metadata: {
            episode: 1,
          },
        }),
        create: vi.fn().mockResolvedValue({
          id: 'artifact_2',
          parentArtifactId: 'artifact_1',
          versionGroupId: 'artifact_1',
        }),
      },
    });
  });

  it('returns the auth response for unauthenticated requests', async () => {
    const responseMarker = new Response(null, { status: 401 });
    mocks.requireViewerResponse.mockResolvedValueOnce({
      viewer: null,
      response: responseMarker,
    });

    const response = await POST(
      new NextRequest('https://app.test/api/artifacts/artifact_1/versions', {
        method: 'POST',
      }),
      { params: Promise.resolve({ artifactId: 'artifact_1' }) }
    );

    expect(response).toBe(responseMarker);
  });

  it('returns 404 for artifacts outside the viewer workspace', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockResolvedValueOnce({
      id: 'artifact_1',
      organizationId: 'org_1',
      workspaceId: 'ws_other',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/artifacts/artifact_1/versions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          content: '新版内容',
        }),
      }),
      { params: Promise.resolve({ artifactId: 'artifact_1' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'ARTIFACT_NOT_FOUND',
    });
    expect(runtime.generationArtifacts.create).not.toHaveBeenCalled();
  });

  it('rejects invalid version payloads before creation', async () => {
    const runtime = mocks.getPlatformRuntime();

    const response = await POST(
      new NextRequest('https://app.test/api/artifacts/artifact_1/versions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          content: '',
        }),
      }),
      { params: Promise.resolve({ artifactId: 'artifact_1' }) }
    );

    expect(response.status).toBe(400);
    expect(runtime.generationArtifacts.create).not.toHaveBeenCalled();
  });

  it('creates a new artifact version with inherited scope and metadata', async () => {
    const runtime = mocks.getPlatformRuntime();

    const response = await POST(
      new NextRequest('https://app.test/api/artifacts/artifact_1/versions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: '第1集剧本（修订）',
          content: '新版内容',
        }),
      }),
      { params: Promise.resolve({ artifactId: 'artifact_1' }) }
    );

    expect(response.status).toBe(200);
    expect(runtime.generationArtifacts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        generationJobId: 'job_1',
        sourceDocumentId: 'source_1',
        kind: 'script',
        format: 'text/plain',
        title: '第1集剧本（修订）',
        content: '新版内容',
        parentArtifactId: 'artifact_1',
        versionGroupId: 'artifact_1',
        isEditable: true,
        createdByUserId: 'user_1',
        metadata: expect.objectContaining({
          episode: 1,
          editedByUserId: 'user_1',
        }),
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      version: {
        id: 'artifact_2',
      },
    });
  });
});

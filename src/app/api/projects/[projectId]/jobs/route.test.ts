import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  getPlatformRuntime: vi.fn(),
  createProjectGenerationJob: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

vi.mock('@/server/generation/service', () => ({
  createProjectGenerationJob: (...args: unknown[]) => mocks.createProjectGenerationJob(...args),
}));

import { GET, POST } from '@/app/api/projects/[projectId]/jobs/route';

describe('project jobs route', () => {
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
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'proj_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
        }),
      },
      generationJobs: {
        listByProjectId: vi.fn().mockResolvedValue([]),
      },
      generationArtifacts: {
        getById: vi.fn(),
      },
    });
  });

  it('rejects unauthenticated requests', async () => {
    const responseMarker = new Response(null, { status: 401 });
    mocks.requireViewerResponse.mockResolvedValueOnce({
      viewer: null,
      response: responseMarker,
    });

    const response = await GET(new NextRequest('https://app.test/api/projects/proj_1/jobs'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(response).toBe(responseMarker);
  });

  it('returns jobs sorted by recency', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationJobs.listByProjectId.mockResolvedValue([
      { id: 'job_old', createdAt: '2026-03-23T10:00:00.000Z' },
      { id: 'job_new', createdAt: '2026-03-24T10:00:00.000Z' },
    ]);

    const response = await GET(new NextRequest('https://app.test/api/projects/proj_1/jobs'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      jobs: [{ id: 'job_new' }, { id: 'job_old' }],
    });
  });

  it('returns 404 when the project does not belong to the viewer workspace', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.projects.getById.mockResolvedValueOnce({
      id: 'proj_1',
      organizationId: 'org_1',
      workspaceId: 'ws_other',
    });

    const response = await GET(new NextRequest('https://app.test/api/projects/proj_1/jobs'), {
      params: Promise.resolve({ projectId: 'proj_1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
  });

  it('normalizes storyboard payloads before job creation', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockImplementation(async (artifactId: string) => {
      if (artifactId === 'script_a') {
        return {
          id: 'script_a',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
          projectId: 'proj_1',
          kind: 'script',
        };
      }

      if (artifactId === 'script_b') {
        return {
          id: 'script_b',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
          projectId: 'proj_1',
          kind: 'script',
        };
      }

      return null;
    });
    mocks.createProjectGenerationJob.mockResolvedValue({
      id: 'job_1',
      kind: 'storyboard-generation',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'storyboard-generation',
          payload: {
            scriptText: '  fallback script  ',
            scriptArtifactIds: [' script_a ', 'script_a', 'script_b'],
            scope: 'selection',
            selection: {
              episodeNumbers: [1, 1, 2],
              sceneIds: [' 1-1 ', '1-2'],
            },
            visualStyle: 'cinematic',
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      job: { id: 'job_1' },
    });
    expect(mocks.createProjectGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        kind: 'storyboard-generation',
        body: expect.objectContaining({
          scope: 'selection',
          scriptArtifactIds: ['script_a', 'script_b'],
          selection: {
            artifactIds: [],
            episodeNumbers: [1, 2],
            sceneIds: ['1-1', '1-2'],
          },
          scriptText: 'fallback script',
          visualStyle: 'cinematic',
        }),
      })
    );
  });

  it('accepts selection-scoped storyboard payloads that directly reference artifact ids', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockResolvedValueOnce({
      id: 'script_selected',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      kind: 'script',
    });
    mocks.createProjectGenerationJob.mockResolvedValue({
      id: 'job_selection',
      kind: 'storyboard-generation',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'storyboard-generation',
          payload: {
            scope: 'selection',
            selection: {
              artifactIds: [' script_selected '],
            },
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.createProjectGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          scope: 'selection',
          selection: {
            artifactIds: ['script_selected'],
            episodeNumbers: [],
            sceneIds: [],
          },
        }),
      })
    );
  });

  it('rejects storyboard payloads that reference foreign artifacts', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockResolvedValueOnce({
      id: 'script_foreign',
      organizationId: 'org_2',
      workspaceId: 'ws_2',
      projectId: 'proj_2',
      kind: 'script',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'storyboard-generation',
          payload: {
            scriptArtifactIds: ['script_foreign'],
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'SCRIPT_ARTIFACT_NOT_IN_PROJECT:script_foreign',
    });
  });

  it('rejects storyboard payloads with no source text or artifacts', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'storyboard-generation',
          payload: {
            visualStyle: 'cinematic',
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(String(payload.error)).toContain('scriptText or scriptArtifactIds');
  });

  it('rejects selection-scoped storyboard payloads without artifact-backed sources', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'storyboard-generation',
          payload: {
            scope: 'selection',
            selection: {
              episodeNumbers: [1],
            },
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('scriptArtifactIds'),
    });
  });

  it('rejects storyboard payloads with non-script artifacts', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockResolvedValueOnce({
      id: 'outline_a',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      kind: 'outline',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'storyboard-generation',
          payload: {
            scriptArtifactIds: ['outline_a'],
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'SCRIPT_ARTIFACT_KIND_INVALID:outline_a',
    });
  });

  it('rejects script-generation payloads with blank text', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'script-generation',
          payload: {
            text: '',
            genre: 'urban',
            config: {
              genre: 'urban',
              episodeCount: 1,
              episodeDuration: '1:30-2:00',
              style: 'dramatic',
            },
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.createProjectGenerationJob).not.toHaveBeenCalled();
  });

  it('rejects script-generation payloads with missing config', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'script-generation',
          payload: {
            text: '正文',
            genre: 'urban',
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.createProjectGenerationJob).not.toHaveBeenCalled();
  });

  it('rejects script-generation payloads with invalid episode counts', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'script-generation',
          payload: {
            text: '正文',
            genre: 'urban',
            config: {
              genre: 'urban',
              episodeCount: 0,
              episodeDuration: '1:30-2:00',
              style: 'dramatic',
            },
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.createProjectGenerationJob).not.toHaveBeenCalled();
  });

  it('rejects script-generation payloads with invalid enum values', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'script-generation',
          payload: {
            text: '正文',
            genre: 'sci-fi',
            config: {
              genre: 'urban',
              episodeCount: 1,
              episodeDuration: '4:00-5:00',
              style: 'mystery',
            },
          },
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.createProjectGenerationJob).not.toHaveBeenCalled();
  });
});

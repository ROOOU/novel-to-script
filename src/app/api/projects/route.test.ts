import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  getPlatformRuntime: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

vi.mock('@/server/projects/service', () => ({
  createProject: (...args: unknown[]) => mocks.createProject(...args),
}));

import { GET, POST } from '@/app/api/projects/route';

describe('projects route', () => {
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
        listByWorkspaceId: vi.fn().mockResolvedValue([]),
      },
    });
    mocks.createProject.mockResolvedValue({
      id: 'proj_1',
      name: 'My Project',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
    });
  });

  it('returns the auth response for unauthenticated GET requests', async () => {
    const responseMarker = new Response(null, { status: 401 });
    mocks.requireViewerResponse.mockResolvedValueOnce({
      viewer: null,
      response: responseMarker,
    });

    const response = await GET();

    expect(response).toBe(responseMarker);
  });

  it('lists projects for the active workspace', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.projects.listByWorkspaceId.mockResolvedValueOnce([
      { id: 'proj_1', name: 'A' },
      { id: 'proj_2', name: 'B' },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      projects: [{ id: 'proj_1', name: 'A' }, { id: 'proj_2', name: 'B' }],
    });
    expect(runtime.projects.listByWorkspaceId).toHaveBeenCalledWith('ws_1');
  });

  it('rejects invalid project payloads before creation', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: '',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it('creates a project for the active workspace', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'My Project',
          description: 'test project',
          genre: 'urban',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.createProject).toHaveBeenCalledWith({
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      userId: 'user_1',
      name: 'My Project',
      description: 'test project',
      genre: 'urban',
    });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      project: {
        id: 'proj_1',
      },
    });
  });
});

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  getPlatformRuntime: vi.fn(),
  createNovelToStoryboardPipeline: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: (...args: unknown[]) => mocks.requireViewerResponse(...args),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

vi.mock('@/server/generation/pipeline-service', () => ({
  createNovelToStoryboardPipeline: (...args: unknown[]) =>
    mocks.createNovelToStoryboardPipeline(...args),
}));

import { POST } from '@/app/api/projects/[projectId]/pipelines/route';

describe('POST /api/projects/[projectId]/pipelines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerResponse.mockResolvedValue({
      viewer: {
        user: { id: 'user_1' },
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
      },
      response: null,
    });
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn(),
      },
    });
  });

  it('creates a novel-to-storyboard pipeline', async () => {
    const project = {
      id: 'proj_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
    };
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue(project),
      },
    });
    mocks.createNovelToStoryboardPipeline.mockResolvedValue({
      mode: 'novel-to-storyboard',
      job: { id: 'job_script_1' },
    });

    const request = new NextRequest('http://localhost/api/projects/proj_1/pipelines', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'novel-to-storyboard',
        payload: {
          text: 'novel text',
          genre: 'urban',
          config: {
            genre: 'urban',
            episodeCount: 6,
            episodeDuration: '1:30-2:00',
            style: 'dramatic',
            includeDirectorNotes: true,
          },
          storyboardConfig: {
            visualStyle: 'cinematic realism',
            safeMode: true,
          },
        },
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request, { params: Promise.resolve({ projectId: 'proj_1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      pipeline: {
        mode: 'novel-to-storyboard',
        job: { id: 'job_script_1' },
      },
    });
    expect(mocks.createNovelToStoryboardPipeline).toHaveBeenCalledWith({
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      userId: 'user_1',
      body: {
        text: 'novel text',
        genre: 'urban',
        config: {
          genre: 'urban',
          episodeCount: 6,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
        storyboardConfig: {
          visualStyle: 'cinematic realism',
          safeMode: true,
        },
      },
    });
  });

  it('returns project not found for foreign projects', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'proj_1',
          organizationId: 'org_other',
          workspaceId: 'ws_1',
        }),
      },
    });

    const request = new NextRequest('http://localhost/api/projects/proj_1/pipelines', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'novel-to-storyboard',
        payload: {
          text: 'novel text',
          genre: 'urban',
          config: {
            genre: 'urban',
            episodeCount: 6,
            episodeDuration: '1:30-2:00',
            style: 'dramatic',
            includeDirectorNotes: true,
          },
        },
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request, { params: Promise.resolve({ projectId: 'proj_1' }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
  });

  it('returns validation errors for invalid payloads', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'proj_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
        }),
      },
    });

    const request = new NextRequest('http://localhost/api/projects/proj_1/pipelines', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'novel-to-storyboard',
        payload: {
          text: '',
          genre: 'urban',
          config: {
            genre: 'urban',
            episodeCount: 0,
            episodeDuration: '1:30-2:00',
            style: 'dramatic',
            includeDirectorNotes: true,
          },
        },
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request, { params: Promise.resolve({ projectId: 'proj_1' }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(typeof payload.error).toBe('string');
    expect(payload.error).toContain('too_small');
  });

  it('maps insufficient credits to 402', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'proj_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
        }),
      },
    });
    mocks.createNovelToStoryboardPipeline.mockRejectedValue(new Error('INSUFFICIENT_CREDITS'));

    const request = new NextRequest('http://localhost/api/projects/proj_1/pipelines', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'novel-to-storyboard',
        payload: {
          text: 'novel text',
          genre: 'urban',
          config: {
            genre: 'urban',
            episodeCount: 6,
            episodeDuration: '1:30-2:00',
            style: 'dramatic',
            includeDirectorNotes: true,
          },
        },
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request, { params: Promise.resolve({ projectId: 'proj_1' }) });
    const payload = await response.json();

    expect(response.status).toBe(402);
    expect(payload).toEqual({
      ok: false,
      error: 'INSUFFICIENT_CREDITS',
    });
  });
});

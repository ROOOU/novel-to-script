import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  getPlatformRuntime: vi.fn(),
  getPlanHeaderDefault: vi.fn(),
  resolvePlatformRequestContext: vi.fn(),
  createProjectGenerationJob: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/generation/service', () => ({
  createProjectGenerationJob: (...args: unknown[]) => mocks.createProjectGenerationJob(...args),
}));

vi.mock('@/server/shared/platform', () => ({
  applyPlatformResponseHeaders: (response: Response, context: any) => {
    response.headers.set('X-Request-Id', String(context.requestId));
    response.headers.set('X-Trace-Id', String(context.traceId));
    response.headers.set('X-Platform-Plan', String(context.plan));
    if (context.organizationId) {
      response.headers.set('X-Organization-Id', String(context.organizationId));
    }
    if (context.workspaceId) {
      response.headers.set('X-Workspace-Id', String(context.workspaceId));
    }
    if (context.projectId) {
      response.headers.set('X-Project-Id', String(context.projectId));
    }
    return response;
  },
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
  getPlanHeaderDefault: (...args: unknown[]) => mocks.getPlanHeaderDefault(...args),
  resolvePlatformRequestContext: (...args: unknown[]) => mocks.resolvePlatformRequestContext(...args),
}));

describe('project jobs api route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewer.mockResolvedValue({
      user: { id: 'user_1', email: 'creator@example.com' },
      organization: { id: 'org_1' },
      workspace: { id: 'ws_1' },
      session: { locale: 'zh-CN' },
      subscription: null,
      creditAccount: null,
    });
    mocks.getPlanHeaderDefault.mockReturnValue('creator');
    mocks.resolvePlatformRequestContext.mockReturnValue({
      requestId: 'req_1',
      traceId: 'trace_1',
      clientIp: '127.0.0.1',
      userAgent: null,
      referer: null,
      locale: null,
      workspaceId: 'ws_1',
      organizationId: 'org_1',
      projectId: 'project_1',
      source: 'session',
      userId: 'user_1',
      sessionId: null,
      plan: 'creator',
    });
  });

  it('returns sorted jobs with platform headers', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'project_1',
          organizationId: 'org_1',
        }),
      },
      generationJobs: {
        listByProjectId: vi.fn().mockResolvedValue([
          { id: 'job_1', createdAt: '2024-01-01T00:00:00.000Z' },
          { id: 'job_2', createdAt: '2024-01-02T00:00:00.000Z' },
        ]),
      },
      generationArtifacts: {
        getById: vi.fn(),
      },
    });

    const { GET } = await import('@/app/api/projects/[projectId]/jobs/route');
    const response = await GET(new NextRequest('https://app.test/api/projects/project_1/jobs'), {
      params: Promise.resolve({ projectId: 'project_1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    expect(response.headers.get('x-organization-id')).toBe('org_1');
    expect(response.headers.get('x-workspace-id')).toBe('ws_1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      jobs: [
        { id: 'job_2', createdAt: '2024-01-02T00:00:00.000Z' },
        { id: 'job_1', createdAt: '2024-01-01T00:00:00.000Z' },
      ],
    });
    expect(mocks.resolvePlatformRequestContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        defaultPlan: 'creator',
        viewerDefaults: {
          userId: 'user_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
        },
      })
    );
  });

  it('creates a job with platform headers', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'project_1',
          organizationId: 'org_1',
        }),
      },
      generationJobs: {
        listByProjectId: vi.fn(),
      },
      generationArtifacts: {
        getById: vi.fn(),
      },
    });
    mocks.createProjectGenerationJob.mockResolvedValue({
      id: 'job_3',
    });

    const { POST } = await import('@/app/api/projects/[projectId]/jobs/route');
    const response = await POST(
      new NextRequest('https://app.test/api/projects/project_1/jobs', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'script-generation',
          payload: {
            text: 'hello',
            genre: 'urban',
            config: {
              genre: 'urban',
              episodeCount: 1,
              episodeDuration: '1:00-1:30',
              style: 'dramatic',
            },
          },
        }),
      }),
      {
        params: Promise.resolve({ projectId: 'project_1' }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      job: {
        id: 'job_3',
      },
    });
  });
});

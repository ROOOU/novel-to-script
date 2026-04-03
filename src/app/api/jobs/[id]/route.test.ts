import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  getPlatformRuntime: vi.fn(),
  getPlanHeaderDefault: vi.fn(),
  resolvePlatformRequestContext: vi.fn(),
  resolveGenerationAccessToken: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
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
  GENERATION_ACCESS_TOKEN_HEADER: 'X-Generation-Access-Token',
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
  getPlanHeaderDefault: (...args: unknown[]) => mocks.getPlanHeaderDefault(...args),
  resolvePlatformRequestContext: (...args: unknown[]) => mocks.resolvePlatformRequestContext(...args),
  resolveGenerationAccessToken: (...args: unknown[]) => mocks.resolveGenerationAccessToken(...args),
}));

describe('job detail api route', () => {
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
    mocks.resolveGenerationAccessToken.mockReturnValue(null);
    mocks.getPlatformRuntime.mockReturnValue({
      generationJobs: {
        getById: vi.fn().mockResolvedValue({
          id: 'job_1',
          organizationId: 'org_1',
        }),
      },
      generationJobAccess: {
        verify: vi.fn().mockReturnValue(false),
      },
    });
    mocks.resolvePlatformRequestContext.mockReturnValue({
      requestId: 'req_1',
      traceId: 'trace_1',
      clientIp: '127.0.0.1',
      userAgent: null,
      referer: null,
      locale: null,
      workspaceId: 'ws_1',
      organizationId: 'org_1',
      projectId: null,
      source: 'session',
      userId: 'user_1',
      sessionId: null,
      plan: 'creator',
    });
  });

  it('passes viewer-derived defaults into the platform context before auth checks', async () => {
    const { GET } = await import('@/app/api/jobs/[id]/route');

    const response = await GET(new NextRequest('https://app.test/api/jobs/job_1'), {
      params: Promise.resolve({ id: 'job_1' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getCurrentViewer).toHaveBeenCalledTimes(1);
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

  it('allows access with a valid generation access token even without a viewer', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);
    mocks.resolveGenerationAccessToken.mockReturnValue('access_token_1');
    mocks.getPlatformRuntime.mockReturnValue({
      generationJobs: {
        getById: vi.fn().mockResolvedValue({
          id: 'job_1',
          organizationId: 'org_1',
        }),
      },
      generationJobAccess: {
        verify: vi.fn().mockReturnValue(true),
      },
    });

    const { GET } = await import('@/app/api/jobs/[id]/route');
    const response = await GET(new NextRequest('https://app.test/api/jobs/job_1'), {
      params: Promise.resolve({ id: 'job_1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    expect(response.headers.get('x-generation-job-id')).toBe('job_1');
    await expect(response.json()).resolves.toEqual({
      id: 'job_1',
      organizationId: 'org_1',
    });
    expect(mocks.resolvePlatformRequestContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        defaultPlan: 'creator',
        viewerDefaults: undefined,
      })
    );
  });
});

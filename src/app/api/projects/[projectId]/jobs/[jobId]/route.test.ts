import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerPlatformContext: vi.fn(),
  getPlatformRuntime: vi.fn(),
  retryProjectGenerationJob: vi.fn(),
  cancelProjectGenerationJob: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerPlatformContext: () => mocks.requireViewerPlatformContext(),
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
}));

vi.mock('@/server/projects/job-actions', () => ({
  retryProjectGenerationJob: (...args: unknown[]) => mocks.retryProjectGenerationJob(...args),
  cancelProjectGenerationJob: (...args: unknown[]) => mocks.cancelProjectGenerationJob(...args),
}));

import { POST } from '@/app/api/projects/[projectId]/jobs/[jobId]/route';

describe('project job action route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerPlatformContext.mockResolvedValue({
      viewer: {
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
        user: { id: 'user_1' },
      },
      context: {
        requestId: 'req_1',
        traceId: 'trace_1',
        clientIp: '127.0.0.1',
        userAgent: null,
        referer: null,
        locale: null,
        workspaceId: 'ws_1',
        organizationId: 'org_1',
        projectId: 'proj_1',
        source: 'session',
        userId: 'user_1',
        sessionId: null,
        plan: 'creator',
      },
      response: null,
    });
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'proj_1',
          organizationId: 'org_1',
        }),
      },
    });
  });

  it('routes retry actions to the retry service', async () => {
    mocks.retryProjectGenerationJob.mockResolvedValue({
      action: 'retry',
      originalJob: { id: 'job_1' },
      job: { id: 'job_2' },
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      action: 'retry',
      job: { id: 'job_2' },
    });
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    expect(response.headers.get('x-organization-id')).toBe('org_1');
    expect(response.headers.get('x-workspace-id')).toBe('ws_1');
    expect(response.headers.get('x-project-id')).toBe('proj_1');
    expect(mocks.retryProjectGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        jobId: 'job_1',
      })
    );
  });

  it('routes cancel actions to the cancel service', async () => {
    mocks.cancelProjectGenerationJob.mockResolvedValue({
      action: 'cancel',
      job: { id: 'job_1', status: 'cancelled' },
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      action: 'cancel',
      job: { id: 'job_1', status: 'cancelled' },
    });
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    expect(mocks.cancelProjectGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        jobId: 'job_1',
      })
    );
  });

  it('returns platform headers on unauthorized responses', async () => {
    mocks.requireViewerPlatformContext.mockResolvedValue({
      viewer: null,
      context: {
        requestId: 'req_unauth',
        traceId: 'trace_unauth',
        clientIp: '127.0.0.1',
        userAgent: null,
        referer: null,
        locale: null,
        workspaceId: null,
        organizationId: null,
        projectId: null,
        source: 'none',
        userId: null,
        sessionId: null,
        plan: 'free',
      },
      response: new Response(JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req_unauth',
          'X-Trace-Id': 'trace_unauth',
          'X-Platform-Plan': 'free',
        },
      }),
    });

    const { POST } = await import('@/app/api/projects/[projectId]/jobs/[jobId]/route');
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBe('req_unauth');
    expect(response.headers.get('x-trace-id')).toBe('trace_unauth');
    expect(response.headers.get('x-platform-plan')).toBe('free');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });
});

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  getPlatformRuntime: vi.fn(),
  getPlanHeaderDefault: vi.fn(),
  resolvePlatformRequestContext: vi.fn(),
  saveProjectSource: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/projects/service', () => ({
  saveProjectSource: (...args: unknown[]) => mocks.saveProjectSource(...args),
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

describe('project source api route', () => {
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

  it('creates a source document with platform headers', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'project_1',
          organizationId: 'org_1',
        }),
      },
    });
    mocks.saveProjectSource.mockResolvedValue({
      id: 'source_1',
      title: 'Source',
      textContent: 'hello',
    });

    const { POST } = await import('@/app/api/projects/[projectId]/source/route');
    const response = await POST(
      new NextRequest('https://app.test/api/projects/project_1/source', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Source',
          textContent: 'hello',
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
      sourceDocument: {
        id: 'source_1',
        title: 'Source',
        textContent: 'hello',
      },
    });
  });

  it('returns unauthorized with platform headers when no viewer is present', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn(),
      },
    });

    const { POST } = await import('@/app/api/projects/[projectId]/source/route');
    const response = await POST(
      new NextRequest('https://app.test/api/projects/project_1/source', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Source',
          textContent: 'hello',
        }),
      }),
      {
        params: Promise.resolve({ projectId: 'project_1' }),
      }
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });
});

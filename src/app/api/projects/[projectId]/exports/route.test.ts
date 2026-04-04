import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  getPlatformRuntime: vi.fn(),
  getPlanHeaderDefault: vi.fn(),
  resolvePlatformRequestContext: vi.fn(),
  createProjectExportArtifact: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/projects/export-service', () => ({
  createProjectExportArtifact: (...args: unknown[]) => mocks.createProjectExportArtifact(...args),
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

describe('project exports api route', () => {
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

  it('creates an export artifact with platform headers', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'project_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
        }),
      },
    });
    mocks.createProjectExportArtifact.mockResolvedValue({
      id: 'artifact_1',
    });

    const { POST } = await import('@/app/api/projects/[projectId]/exports/route');
    const response = await POST(
      new NextRequest('https://app.test/api/projects/project_1/exports', {
        method: 'POST',
        body: JSON.stringify({
          format: 'markdown',
        }),
      }),
      {
        params: Promise.resolve({ projectId: 'project_1' }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      artifact: {
        id: 'artifact_1',
      },
      downloadUrl: '/api/artifacts/artifact_1/download',
    });
  });

  it('returns project not found with platform headers when the project is missing', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue(null),
      },
    });

    const { POST } = await import('@/app/api/projects/[projectId]/exports/route');
    const response = await POST(
      new NextRequest('https://app.test/api/projects/project_1/exports', {
        method: 'POST',
        body: JSON.stringify({
          format: 'markdown',
        }),
      }),
      {
        params: Promise.resolve({ projectId: 'project_1' }),
      }
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
  });
});

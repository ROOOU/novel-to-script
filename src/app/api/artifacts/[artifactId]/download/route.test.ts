import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerPlatformContext: vi.fn(),
  getPlatformRuntime: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerPlatformContext: (...args: unknown[]) => mocks.requireViewerPlatformContext(...args),
}));

vi.mock('@/server/shared/platform', async () => {
  const actual = await vi.importActual<typeof import('@/server/shared/platform')>(
    '@/server/shared/platform'
  );

  return {
    ...actual,
    getPlatformRuntime: () => mocks.getPlatformRuntime(),
  };
});

describe('artifact download route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerPlatformContext.mockResolvedValue({
      viewer: {
        user: { id: 'user_1' },
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
      },
      response: null,
      context: {
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
      },
    });
  });

  it('returns artifacts with platform headers', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById: vi.fn().mockResolvedValue({
          id: 'artifact_1',
          organizationId: 'org_1',
          title: 'Exported Script',
          format: 'text/plain',
          content: 'hello',
          metadata: {},
        }),
      },
    });

    const { GET } = await import('@/app/api/artifacts/[artifactId]/download/route');
    const response = await GET(new NextRequest('https://app.test/api/artifacts/artifact_1/download'), {
      params: Promise.resolve({ artifactId: 'artifact_1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('content-disposition')).toContain('exported-script.txt');
    await expect(response.text()).resolves.toBe('hello');
  });

  it('returns platform headers for missing artifacts', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById: vi.fn().mockResolvedValue(null),
      },
    });

    const { GET } = await import('@/app/api/artifacts/[artifactId]/download/route');
    const response = await GET(new NextRequest('https://app.test/api/artifacts/artifact_1/download'), {
      params: Promise.resolve({ artifactId: 'artifact_1' }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'ARTIFACT_NOT_FOUND',
    });
  });
});

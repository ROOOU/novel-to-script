import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerPlatformContext: vi.fn(),
  getPlatformRuntime: vi.fn(),
  getStoryboardRequestError: vi.fn(),
  createPlatformJsonErrorResponse: vi.fn(),
  evaluatePlatformFeatureAccess: vi.fn(),
  evaluateUsagePreflight: vi.fn(),
  getUsageBudgetFromEntitlements: vi.fn(),
  resolveRuntimeOrganizationId: vi.fn(),
  resolveRuntimeProjectId: vi.fn(),
  resolveRuntimeWorkspaceId: vi.fn(),
  resolvePlatformLLMConfig: vi.fn(),
  runStoryboardGeneration: vi.fn(),
  createSSEStreamResponse: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  createRateLimitResponse: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerPlatformContext: (...args: unknown[]) => mocks.requireViewerPlatformContext(...args),
}));

vi.mock('@/server/shared/platform', () => ({
  applyPlatformResponseHeaders: (response: Response) => response,
  createPlatformJsonErrorResponse: (...args: unknown[]) => mocks.createPlatformJsonErrorResponse(...args),
  evaluatePlatformFeatureAccess: (...args: unknown[]) => mocks.evaluatePlatformFeatureAccess(...args),
  evaluateUsagePreflight: (...args: unknown[]) => mocks.evaluateUsagePreflight(...args),
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
  getUsageBudgetFromEntitlements: (...args: unknown[]) => mocks.getUsageBudgetFromEntitlements(...args),
  resolveRuntimeOrganizationId: (...args: unknown[]) => mocks.resolveRuntimeOrganizationId(...args),
  resolveRuntimeProjectId: (...args: unknown[]) => mocks.resolveRuntimeProjectId(...args),
  resolveRuntimeWorkspaceId: (...args: unknown[]) => mocks.resolveRuntimeWorkspaceId(...args),
  resolvePlatformLLMConfig: (...args: unknown[]) => mocks.resolvePlatformLLMConfig(...args),
}));

vi.mock('@/server/storyboard/application/run-storyboard-generation', () => ({
  getStoryboardRequestError: (...args: unknown[]) => mocks.getStoryboardRequestError(...args),
  runStoryboardGeneration: (...args: unknown[]) => mocks.runStoryboardGeneration(...args),
}));

vi.mock('@/server/shared/sse', () => ({
  createSSEStreamResponse: (...args: unknown[]) => mocks.createSSEStreamResponse(...args),
}));

describe('storyboard api route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerPlatformContext.mockResolvedValue({
      viewer: {
        user: { id: 'user_1', email: 'creator@example.com' },
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
        session: { locale: 'zh-CN' },
        subscription: null,
        creditAccount: null,
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
    mocks.getPlatformRuntime.mockReturnValue({
      usageMeter: {
        snapshot: vi.fn().mockResolvedValue({}),
      },
      generationJobs: {
        listActiveByWorkspaceId: vi.fn().mockResolvedValue([]),
      },
    });
    mocks.getStoryboardRequestError.mockReturnValue('validation failed');
    mocks.createPlatformJsonErrorResponse.mockImplementation((_context, message, status) =>
      new Response(JSON.stringify({ message }), { status })
    );
  });

  it('uses the viewer-required platform context helper', async () => {
    const { POST } = await import('@/app/api/storyboard/route');

    const response = await POST(
      new NextRequest('https://app.test/api/storyboard', {
        method: 'POST',
        body: JSON.stringify({
          scriptText: 'hello',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.requireViewerPlatformContext).toHaveBeenCalledWith(expect.anything());
    expect(mocks.resolveRuntimeWorkspaceId).toHaveBeenCalledWith('ws_1');
    expect(mocks.createPlatformJsonErrorResponse).toHaveBeenCalledWith(
      expect.anything(),
      'validation failed',
      400
    );
  });

  it('returns the shared unauthorized response when viewer resolution fails', async () => {
    mocks.requireViewerPlatformContext.mockResolvedValueOnce({
      viewer: null,
      response: new Response(JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_unauthorized',
        },
      }),
      context: {
        requestId: 'req_unauthorized',
        traceId: 'trace_unauthorized',
      },
    });

    const { POST } = await import('@/app/api/storyboard/route');

    const response = await POST(
      new NextRequest('https://app.test/api/storyboard', {
        method: 'POST',
        body: JSON.stringify({
          scriptText: 'hello',
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.getPlatformRuntime).not.toHaveBeenCalled();
    expect(response.headers.get('x-request-id')).toBe('req_unauthorized');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });
});

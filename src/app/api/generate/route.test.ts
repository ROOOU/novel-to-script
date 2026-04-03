import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  getPlatformRuntime: vi.fn(),
  getPlanHeaderDefault: vi.fn(),
  resolvePlatformRequestContext: vi.fn(),
  getScriptGenerationRequestError: vi.fn(),
  createPlatformJsonErrorResponse: vi.fn(),
  evaluatePlatformFeatureAccess: vi.fn(),
  evaluateUsagePreflight: vi.fn(),
  getUsageBudgetFromEntitlements: vi.fn(),
  resolveRuntimeOrganizationId: vi.fn(),
  resolveRuntimeProjectId: vi.fn(),
  resolveRuntimeWorkspaceId: vi.fn(),
  resolvePlatformLLMConfig: vi.fn(),
  runScriptGeneration: vi.fn(),
  createSSEStreamResponse: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  createRateLimitResponse: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/shared/platform', () => ({
  applyPlatformResponseHeaders: (response: Response) => response,
  createPlatformJsonErrorResponse: (...args: unknown[]) => mocks.createPlatformJsonErrorResponse(...args),
  evaluatePlatformFeatureAccess: (...args: unknown[]) => mocks.evaluatePlatformFeatureAccess(...args),
  evaluateUsagePreflight: (...args: unknown[]) => mocks.evaluateUsagePreflight(...args),
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
  getPlanHeaderDefault: (...args: unknown[]) => mocks.getPlanHeaderDefault(...args),
  getUsageBudgetFromEntitlements: (...args: unknown[]) => mocks.getUsageBudgetFromEntitlements(...args),
  resolvePlatformRequestContext: (...args: unknown[]) => mocks.resolvePlatformRequestContext(...args),
  resolveRuntimeOrganizationId: (...args: unknown[]) => mocks.resolveRuntimeOrganizationId(...args),
  resolveRuntimeProjectId: (...args: unknown[]) => mocks.resolveRuntimeProjectId(...args),
  resolveRuntimeWorkspaceId: (...args: unknown[]) => mocks.resolveRuntimeWorkspaceId(...args),
  resolvePlatformLLMConfig: (...args: unknown[]) => mocks.resolvePlatformLLMConfig(...args),
}));

vi.mock('@/server/script-generation/application/run-script-generation', () => ({
  getScriptGenerationRequestError: (...args: unknown[]) => mocks.getScriptGenerationRequestError(...args),
  runScriptGeneration: (...args: unknown[]) => mocks.runScriptGeneration(...args),
}));

vi.mock('@/server/shared/sse', () => ({
  createSSEStreamResponse: (...args: unknown[]) => mocks.createSSEStreamResponse(...args),
}));

describe('generate api route', () => {
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
    mocks.getPlatformRuntime.mockReturnValue({
      usageMeter: {
        snapshot: vi.fn().mockResolvedValue({}),
      },
      generationJobs: {
        listActiveByWorkspaceId: vi.fn().mockResolvedValue([]),
      },
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
      projectId: null,
      source: 'session',
      userId: 'user_1',
      sessionId: null,
      plan: 'creator',
    });
    mocks.getScriptGenerationRequestError.mockReturnValue('validation failed');
    mocks.createPlatformJsonErrorResponse.mockImplementation((_context, message, status) =>
      new Response(JSON.stringify({ message }), { status })
    );
  });

  it('passes viewer-derived defaults into the platform context', async () => {
    const { POST } = await import('@/app/api/generate/route');

    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          text: 'hello',
          genre: 'drama',
          config: {
            episodeCount: 1,
            episodeDuration: 60,
            style: 'cinematic',
          },
        }),
      })
    );

    expect(response.status).toBe(400);
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

  it('keeps anonymous access working through optional viewer resolution', async () => {
    mocks.getCurrentViewer.mockRejectedValueOnce(new Error('no active viewer'));

    const { POST } = await import('@/app/api/generate/route');

    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          text: 'hello',
          genre: 'drama',
          config: {
            episodeCount: 1,
            episodeDuration: 60,
            style: 'cinematic',
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.getCurrentViewer).toHaveBeenCalledTimes(1);
    expect(mocks.resolvePlatformRequestContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        defaultPlan: 'creator',
        viewerDefaults: undefined,
      })
    );
  });
});

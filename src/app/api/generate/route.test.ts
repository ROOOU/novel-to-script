import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRateLimitResponse: vi.fn(),
  runScriptGeneration: vi.fn(),
  getPlatformRuntime: vi.fn(),
  evaluatePlatformFeatureAccess: vi.fn(),
  evaluateUsagePreflight: vi.fn(),
  getUsageBudgetFromEntitlements: vi.fn(),
  resolvePlatformRequestContext: vi.fn(),
  getPlanHeaderDefault: vi.fn(),
  resolveRuntimeOrganizationId: vi.fn(),
  resolveRuntimeWorkspaceId: vi.fn(),
  resolveRuntimeProjectId: vi.fn(),
  resolvePlatformLLMConfig: vi.fn(),
  createPlatformJsonErrorResponse: vi.fn(),
  applyPlatformResponseHeaders: vi.fn(),
  createSSEStreamResponse: vi.fn(),
  lastSSEProducer: null as null | ((send: (event: unknown) => void) => Promise<void>),
  lastSSEOptions: null as null | { onError?: (error: unknown) => unknown },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mocks.checkRateLimit(...args),
  createRateLimitResponse: (...args: unknown[]) => mocks.createRateLimitResponse(...args),
}));

vi.mock('@/server/script-generation/application/run-script-generation', async () => {
  const actual =
    await vi.importActual<typeof import('@/server/script-generation/application/run-script-generation')>(
      '@/server/script-generation/application/run-script-generation'
    );
  return {
    ...actual,
    runScriptGeneration: (...args: unknown[]) => mocks.runScriptGeneration(...args),
  };
});

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
  evaluatePlatformFeatureAccess: (...args: unknown[]) => mocks.evaluatePlatformFeatureAccess(...args),
  evaluateUsagePreflight: (...args: unknown[]) => mocks.evaluateUsagePreflight(...args),
  getUsageBudgetFromEntitlements: (...args: unknown[]) => mocks.getUsageBudgetFromEntitlements(...args),
  resolvePlatformRequestContext: (...args: unknown[]) => mocks.resolvePlatformRequestContext(...args),
  getPlanHeaderDefault: (...args: unknown[]) => mocks.getPlanHeaderDefault(...args),
  resolveRuntimeOrganizationId: (...args: unknown[]) => mocks.resolveRuntimeOrganizationId(...args),
  resolveRuntimeWorkspaceId: (...args: unknown[]) => mocks.resolveRuntimeWorkspaceId(...args),
  resolveRuntimeProjectId: (...args: unknown[]) => mocks.resolveRuntimeProjectId(...args),
  resolvePlatformLLMConfig: (...args: unknown[]) => mocks.resolvePlatformLLMConfig(...args),
  createPlatformJsonErrorResponse: (...args: unknown[]) => mocks.createPlatformJsonErrorResponse(...args),
  applyPlatformResponseHeaders: (...args: unknown[]) => mocks.applyPlatformResponseHeaders(...args),
}));

vi.mock('@/server/shared/sse', () => ({
  createSSEStreamResponse: (...args: unknown[]) => mocks.createSSEStreamResponse(...args),
}));

import { POST } from '@/app/api/generate/route';

describe('legacy generate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lastSSEProducer = null;
    mocks.lastSSEOptions = null;
    const runtime = {
      usageMeter: {
        snapshot: vi.fn().mockResolvedValue({
          workspaceId: 'ws_runtime',
          requests: 0,
          jobs: 0,
          tokens: 0,
          characters: 0,
          exports: 0,
          periodStart: '2026-03-01T00:00:00.000Z',
          periodEnd: '2026-04-01T00:00:00.000Z',
        }),
      },
      generationJobs: {
        listActiveByWorkspaceId: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({
          id: 'job_1',
          organizationId: 'org_runtime',
          workspaceId: 'ws_runtime',
          projectId: 'proj_runtime',
        }),
        markRunning: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        markSucceeded: vi.fn().mockResolvedValue(undefined),
        markFailed: vi.fn().mockResolvedValue(undefined),
      },
      generationArtifacts: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      generationJobAccess: {
        issue: vi.fn().mockReturnValue('access-token-1'),
      },
    };
    mocks.getPlatformRuntime.mockReturnValue(runtime);
    mocks.checkRateLimit.mockReturnValue({ allowed: true });
    mocks.getPlanHeaderDefault.mockReturnValue('free');
    mocks.resolvePlatformRequestContext.mockReturnValue({
      requestId: 'req_1',
      traceId: 'trace_1',
      organizationId: 'org_ctx',
      workspaceId: 'ws_ctx',
      projectId: 'proj_ctx',
      userId: 'user_ctx',
      sessionId: 'session_ctx',
      plan: 'free',
      source: 'default',
      locale: null,
      clientIp: '127.0.0.1',
      userAgent: null,
      referer: null,
    });
    mocks.resolveRuntimeOrganizationId.mockReturnValue('org_runtime');
    mocks.resolveRuntimeWorkspaceId.mockReturnValue('ws_runtime');
    mocks.resolveRuntimeProjectId.mockReturnValue('proj_runtime');
    mocks.evaluatePlatformFeatureAccess.mockReturnValue({
      allowed: true,
      entitlements: { maxEpisodeCount: 5 },
    });
    mocks.getUsageBudgetFromEntitlements.mockReturnValue({});
    mocks.evaluateUsagePreflight.mockReturnValue({ allowed: true });
    mocks.resolvePlatformLLMConfig.mockReturnValue({
      error: null,
      config: {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
      },
    });
    mocks.createPlatformJsonErrorResponse.mockImplementation(
      (_context: unknown, error: string, status: number) =>
        new Response(JSON.stringify({ error }), {
          status,
          headers: { 'content-type': 'application/json' },
        })
    );
    mocks.createSSEStreamResponse.mockImplementation((producer, options) => {
      mocks.lastSSEProducer = producer as (send: (event: unknown) => void) => Promise<void>;
      mocks.lastSSEOptions = (options as { onError?: (error: unknown) => unknown } | undefined) ?? null;
      return new Response('stream');
    });
    mocks.applyPlatformResponseHeaders.mockImplementation((response: Response) => {
      response.headers.set('x-platform-applied', 'true');
      return response;
    });
    mocks.runScriptGeneration.mockResolvedValue(undefined);
  });

  it('returns the rate-limit response before touching generation state', async () => {
    const responseMarker = new Response('limited', { status: 429 });
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, retryAfter: 10 });
    mocks.createRateLimitResponse.mockReturnValueOnce(responseMarker);

    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    );

    expect(response).toBe(responseMarker);
    expect(mocks.getPlatformRuntime).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid generation payloads before touching runtime state', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: '',
          genre: 'urban',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '缺少必要参数',
    });
    expect(mocks.getPlatformRuntime).not.toHaveBeenCalled();
    expect(mocks.evaluatePlatformFeatureAccess).not.toHaveBeenCalled();
    expect(mocks.resolvePlatformLLMConfig).not.toHaveBeenCalled();
    expect(mocks.createSSEStreamResponse).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON before touching runtime state', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"text":',
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '请求体不是合法 JSON',
    });
    expect(mocks.getPlatformRuntime).not.toHaveBeenCalled();
    expect(mocks.evaluatePlatformFeatureAccess).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid enum and numeric payload values', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: '正文',
          genre: 'sci-fi',
          config: {
            genre: 'urban',
            episodeCount: 1.5,
            episodeDuration: '4:00-5:00',
            style: 'mystery',
          },
          analysis: [],
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.getPlatformRuntime).not.toHaveBeenCalled();
    expect(mocks.evaluatePlatformFeatureAccess).not.toHaveBeenCalled();
  });

  it('returns 403 when the plan entitlement check fails', async () => {
    mocks.evaluatePlatformFeatureAccess.mockReturnValueOnce({
      allowed: false,
      reason: 'free 套餐最多支持 5 集',
      status: 403,
      entitlements: { maxEpisodeCount: 5 },
    });

    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody()),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'free 套餐最多支持 5 集',
    });
    expect(mocks.evaluateUsagePreflight).not.toHaveBeenCalled();
  });

  it('returns 403 when usage preflight fails', async () => {
    mocks.evaluateUsagePreflight.mockReturnValueOnce({
      allowed: false,
      reason: '当前请求已超出使用额度',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody()),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: '当前请求已超出使用额度',
    });
    expect(mocks.resolvePlatformLLMConfig).not.toHaveBeenCalled();
  });

  it('returns 500 when no LLM config can be resolved', async () => {
    mocks.resolvePlatformLLMConfig.mockReturnValueOnce({
      error: '服务端未配置 LLM API Key，请在后端环境变量中设置 LLM_API_KEY。',
      config: null,
    });

    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody()),
      })
    );

    expect(response.status).toBe(500);
    expect(mocks.createSSEStreamResponse).not.toHaveBeenCalled();
  });

  it('creates a job, issues an access token, and returns SSE headers on success', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody()),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Generation-Job-Id')).toBe('job_1');
    expect(response.headers.get('X-Generation-Access-Token')).toBe('access-token-1');
    expect(response.headers.get('x-platform-applied')).toBe('true');
    const runtime = mocks.getPlatformRuntime.mock.results[0]?.value;
    expect(runtime.generationJobs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_runtime',
        workspaceId: 'ws_runtime',
        projectId: 'proj_runtime',
        kind: 'script-generation',
        inputSnapshot: expect.objectContaining({
          generationMode: 'quick',
          targetOutput: 'script',
          executionMode: expect.stringMatching(/direct|segmented/),
          complexityInfo: expect.objectContaining({
            recommendedExecutionMode: expect.stringMatching(/direct|segmented/),
          }),
          chunkPlan: expect.objectContaining({
            chunkCount: expect.any(Number),
            chunks: expect.any(Array),
          }),
          metadata: expect.objectContaining({
            generationMode: 'quick',
            targetOutput: 'script',
            executionMode: expect.stringMatching(/direct|segmented/),
            complexityInfo: expect.objectContaining({
              recommendedExecutionMode: expect.stringMatching(/direct|segmented/),
            }),
            chunkPlan: expect.objectContaining({
              strategy: expect.stringMatching(/single|segmented/),
              chunkCount: expect.any(Number),
              chunks: expect.any(Array),
            }),
          }),
        }),
      })
    );
    expect(mocks.createSSEStreamResponse).toHaveBeenCalled();
  });

  it('preserves an explicit segmented execution mode in the legacy route body', async () => {
    await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...validBody(),
          mode: 'longform',
          targetOutput: 'prompt_pack',
          executionMode: 'segmented',
        }),
      })
    );

    const runtime = mocks.getPlatformRuntime.mock.results[0]?.value;
    expect(runtime.generationJobs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          generationMode: 'longform',
          targetOutput: 'prompt_pack',
          executionMode: 'segmented',
          metadata: expect.objectContaining({
            generationMode: 'longform',
            targetOutput: 'prompt_pack',
            executionMode: 'segmented',
          }),
        }),
      })
    );
    expect(mocks.runScriptGeneration).not.toHaveBeenCalled();
  });

  it('marks the job failed when the SSE producer generation step throws', async () => {
    mocks.runScriptGeneration.mockRejectedValueOnce(new Error('LLM timeout'));

    const response = await POST(
      new NextRequest('https://app.test/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody()),
      })
    );

    expect(response.status).toBe(200);
    const producer = mocks.lastSSEProducer;
    const runtime = mocks.getPlatformRuntime.mock.results[0]?.value;

    expect(producer).not.toBeNull();
    await expect(producer?.(() => undefined)).rejects.toThrow('LLM timeout');
    expect(runtime.generationJobs.markFailed).toHaveBeenCalledWith('job_1', {
      errorMessage: 'LLM timeout',
      updatedByUserId: 'user_ctx',
    });
    expect(runtime.generationJobs.markSucceeded).not.toHaveBeenCalled();
    expect(mocks.lastSSEOptions?.onError?.(new Error('LLM timeout'))).toEqual({
      step: 'error',
      message: 'LLM timeout',
    });
  });
});

function validBody() {
  return {
    text: '原文内容',
    genre: 'urban',
    config: {
      genre: 'urban',
      episodeCount: 1,
      episodeDuration: '1:30-2:00',
      style: 'dramatic',
      includeDirectorNotes: true,
    },
  };
}

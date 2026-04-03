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

describe('admin redeem code campaign generate route', () => {
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

  it('generates codes with platform headers', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      redeemCodeCampaigns: {
        getById: vi.fn().mockResolvedValue({
          id: 'campaign_1',
          organizationId: 'org_1',
          codePrefix: 'NS',
          creditsGranted: 100,
        }),
      },
      redeemCodes: {
        create: vi.fn().mockImplementation(async ({ code }) => ({
          id: `redeem_${code}`,
          code,
        })),
      },
    });

    const { POST } = await import('@/app/api/admin/redeem-code-campaigns/[id]/generate/route');
    const response = await POST(
      new NextRequest('https://app.test/api/admin/redeem-code-campaigns/campaign_1/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count: 2 }),
      }),
      {
        params: Promise.resolve({ id: 'campaign_1' }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      codes: [
        expect.objectContaining({
          id: expect.stringMatching(/^redeem_NS-/),
          code: expect.stringMatching(/^NS-/),
        }),
        expect.objectContaining({
          id: expect.stringMatching(/^redeem_NS-/),
          code: expect.stringMatching(/^NS-/),
        }),
      ],
    });
  });

  it('returns platform headers for missing campaigns', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      redeemCodeCampaigns: {
        getById: vi.fn().mockResolvedValue(null),
      },
      redeemCodes: {
        create: vi.fn(),
      },
    });

    const { POST } = await import('@/app/api/admin/redeem-code-campaigns/[id]/generate/route');
    const response = await POST(
      new NextRequest('https://app.test/api/admin/redeem-code-campaigns/campaign_1/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count: 1 }),
      }),
      {
        params: Promise.resolve({ id: 'campaign_1' }),
      }
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'CAMPAIGN_NOT_FOUND',
    });
  });
});

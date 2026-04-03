import { NextRequest, NextResponse } from 'next/server';
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

describe('admin redeem code campaigns route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates campaigns with platform headers', async () => {
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
    mocks.getPlatformRuntime.mockReturnValue({
      redeemCodeCampaigns: {
        create: vi.fn().mockResolvedValue({
          id: 'campaign_1',
          name: 'Launch',
        }),
      },
    });

    const { POST } = await import('@/app/api/admin/redeem-code-campaigns/route');
    const response = await POST(
      new NextRequest('https://app.test/api/admin/redeem-code-campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Launch',
          creditsGranted: 100,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      campaign: {
        id: 'campaign_1',
        name: 'Launch',
      },
    });
  });

  it('passes through unauthorized responses', async () => {
    mocks.requireViewerPlatformContext.mockResolvedValue({
      viewer: null,
      response: NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED',
        },
        {
          status: 401,
          headers: {
            'x-request-id': 'req_unauth',
            'x-trace-id': 'trace_unauth',
            'x-platform-plan': 'free',
          },
        }
      ),
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
    });

    const { POST } = await import('@/app/api/admin/redeem-code-campaigns/route');
    const response = await POST(
      new NextRequest('https://app.test/api/admin/redeem-code-campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Launch',
          creditsGranted: 100,
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBe('req_unauth');
    expect(response.headers.get('x-trace-id')).toBe('trace_unauth');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });
});

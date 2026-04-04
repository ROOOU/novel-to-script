import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerPlatformContext: vi.fn(),
  getPlatformRuntime: vi.fn(),
  fulfillPaymentOrder: vi.fn(),
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

vi.mock('@/server/billing/payments', () => ({
  fulfillPaymentOrder: (...args: unknown[]) => mocks.fulfillPaymentOrder(...args),
}));

describe('admin payment order confirm route', () => {
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

  it('returns fulfilled payment orders with platform headers', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      paymentOrders: {
        getById: vi.fn().mockResolvedValue({
          id: 'order_1',
          organizationId: 'org_1',
        }),
      },
    });
    mocks.fulfillPaymentOrder.mockResolvedValue({
      id: 'order_1',
      status: 'paid',
    });

    const { POST } = await import('@/app/api/admin/payment-orders/[id]/confirm/route');
    const response = await POST(new NextRequest('https://app.test/api/admin/payment-orders/order_1/confirm'), {
      params: Promise.resolve({ id: 'order_1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      order: {
        id: 'order_1',
        status: 'paid',
      },
    });
  });

  it('returns platform headers on missing payment orders', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      paymentOrders: {
        getById: vi.fn().mockResolvedValue(null),
      },
    });

    const { POST } = await import('@/app/api/admin/payment-orders/[id]/confirm/route');
    const response = await POST(new NextRequest('https://app.test/api/admin/payment-orders/order_1/confirm'), {
      params: Promise.resolve({ id: 'order_1' }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'ORDER_NOT_FOUND',
    });
  });
});

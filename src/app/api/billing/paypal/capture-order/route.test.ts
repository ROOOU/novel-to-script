import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  capturePaymentOrder: vi.fn(),
  findPaymentOrderByProviderOrderId: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/billing/payments', () => ({
  capturePaymentOrder: (...args: unknown[]) => mocks.capturePaymentOrder(...args),
  findPaymentOrderByProviderOrderId: (...args: unknown[]) => mocks.findPaymentOrderByProviderOrderId(...args),
}));

describe('billing capture order api route', () => {
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
  });

  it('returns platform headers when capturing by paymentOrderId', async () => {
    mocks.capturePaymentOrder.mockResolvedValue({
      id: 'order_1',
      status: 'captured',
    });

    const { POST } = await import('@/app/api/billing/paypal/capture-order/route');
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          paymentOrderId: 'order_1',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      order: { id: 'order_1', status: 'captured' },
    });
  });

  it('returns platform headers on not found responses', async () => {
    mocks.findPaymentOrderByProviderOrderId.mockResolvedValue(null);

    const { POST } = await import('@/app/api/billing/paypal/capture-order/route');
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerOrderId: 'provider_1',
        }),
      })
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'PAYMENT_ORDER_NOT_FOUND',
    });
  });

  it('returns unauthorized with platform headers when no viewer is present', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const { POST } = await import('@/app/api/billing/paypal/capture-order/route');
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          paymentOrderId: 'order_1',
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });
});

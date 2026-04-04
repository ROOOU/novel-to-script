import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  headers: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: () => mocks.headers(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/billing/payments', () => ({
  createSubscriptionCheckout: (...args: unknown[]) => mocks.createSubscriptionCheckout(...args),
}));

describe('billing create subscription api route', () => {
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
    mocks.headers.mockResolvedValue(new Headers({ origin: 'https://app.test' }));
    mocks.createSubscriptionCheckout.mockResolvedValue({
      id: 'checkout_sub_1',
    });
  });

  it('returns platform headers on successful subscription checkout creation', async () => {
    const { POST } = await import('@/app/api/billing/paypal/create-subscription/route');
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/create-subscription', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://app.test',
        },
        body: JSON.stringify({
          planKey: 'pro',
          requestedCurrency: 'USD',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      checkout: { id: 'checkout_sub_1' },
    });
  });

  it('returns unauthorized with platform headers when no viewer is present', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const { POST } = await import('@/app/api/billing/paypal/create-subscription/route');
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/create-subscription', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          planKey: 'pro',
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

  it('returns platform headers on validation errors', async () => {
    const { POST } = await import('@/app/api/billing/paypal/create-subscription/route');
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/create-subscription', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          planKey: '',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });
});

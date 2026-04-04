import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlePayPalWebhook: vi.fn(),
  resolvePayPalWebhookHeaders: vi.fn(),
  verifyPayPalWebhookSignature: vi.fn(),
}));

vi.mock('@/server/billing/payments', () => ({
  handlePayPalWebhook: (...args: unknown[]) => mocks.handlePayPalWebhook(...args),
}));

vi.mock('@/server/billing/paypal', () => ({
  resolvePayPalWebhookHeaders: (...args: unknown[]) => mocks.resolvePayPalWebhookHeaders(...args),
  verifyPayPalWebhookSignature: (...args: unknown[]) => mocks.verifyPayPalWebhookSignature(...args),
}));

describe('billing paypal webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvePayPalWebhookHeaders.mockReturnValue({
      transmissionId: 'tx_1',
      transmissionTime: '2026-04-04T00:00:00Z',
      transmissionSig: 'sig_1',
      certUrl: 'https://paypal.test/cert',
      authAlgo: 'SHA256withRSA',
    });
    mocks.verifyPayPalWebhookSignature.mockResolvedValue(true);
    mocks.handlePayPalWebhook.mockResolvedValue({
      ok: true,
      action: 'order_fulfilled',
    });
  });

  it('returns 400 when webhook headers are missing', async () => {
    mocks.resolvePayPalWebhookHeaders.mockReturnValue({
      transmissionId: null,
      transmissionTime: null,
      transmissionSig: null,
      certUrl: null,
      authAlgo: null,
    });

    const { POST } = await import('@/app/api/billing/paypal/webhook/route');
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'CHECKOUT.ORDER.APPROVED',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'PAYPAL_WEBHOOK_HEADERS_MISSING',
    });
  });

  it('returns 5xx when webhook processing fails internally', async () => {
    mocks.handlePayPalWebhook.mockRejectedValue(new Error('db unavailable'));

    const { POST } = await import('@/app/api/billing/paypal/webhook/route');
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'CHECKOUT.ORDER.APPROVED',
          resource: {
            custom_id: 'order_1',
          },
        }),
      })
    );

    expect(mocks.verifyPayPalWebhookSignature).toHaveBeenCalledTimes(1);
    expect(mocks.handlePayPalWebhook).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'db unavailable',
    });
  });
});

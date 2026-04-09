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

import { POST } from '@/app/api/billing/paypal/webhook/route';

describe('paypal webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvePayPalWebhookHeaders.mockReturnValue({
      transmissionId: 'tx-1',
      transmissionTime: '2026-03-24T00:00:00Z',
      transmissionSig: 'sig-1',
      certUrl: 'https://paypal.test/cert',
      authAlgo: 'SHA256withRSA',
    });
    mocks.verifyPayPalWebhookSignature.mockResolvedValue(true);
    mocks.handlePayPalWebhook.mockResolvedValue({
      ok: true,
      action: 'order_fulfilled',
    });
  });

  it('rejects webhook requests that are missing required headers', async () => {
    mocks.resolvePayPalWebhookHeaders.mockReturnValueOnce({
      transmissionId: null,
      transmissionTime: '2026-03-24T00:00:00Z',
      transmissionSig: 'sig-1',
      certUrl: 'https://paypal.test/cert',
      authAlgo: 'SHA256withRSA',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_type: 'CHECKOUT.ORDER.COMPLETED' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PAYPAL_WEBHOOK_HEADERS_MISSING',
    });
    expect(mocks.verifyPayPalWebhookSignature).not.toHaveBeenCalled();
    expect(mocks.handlePayPalWebhook).not.toHaveBeenCalled();
  });

  it('rejects webhook requests with invalid signatures', async () => {
    mocks.verifyPayPalWebhookSignature.mockResolvedValueOnce(false);

    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_type: 'CHECKOUT.ORDER.COMPLETED' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PAYPAL_WEBHOOK_SIGNATURE_INVALID',
    });
    expect(mocks.handlePayPalWebhook).not.toHaveBeenCalled();
  });

  it('verifies the signature and returns the delivery result', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'CHECKOUT.ORDER.COMPLETED',
          resource: { custom_id: 'payment_order_1' },
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      received: true,
      result: {
        ok: true,
        action: 'order_fulfilled',
      },
    });
    expect(mocks.verifyPayPalWebhookSignature).toHaveBeenCalledWith({
      event: {
        event_type: 'CHECKOUT.ORDER.COMPLETED',
        resource: { custom_id: 'payment_order_1' },
      },
      transmissionId: 'tx-1',
      transmissionTime: '2026-03-24T00:00:00Z',
      transmissionSig: 'sig-1',
      certUrl: 'https://paypal.test/cert',
      authAlgo: 'SHA256withRSA',
    });
    expect(mocks.handlePayPalWebhook).toHaveBeenCalledWith({
      event_type: 'CHECKOUT.ORDER.COMPLETED',
      resource: { custom_id: 'payment_order_1' },
    });
  });

  it('maps delivery errors to 400 responses', async () => {
    mocks.handlePayPalWebhook.mockRejectedValueOnce(new Error('PAYPAL_WEBHOOK_CUSTOM_ID_MISSING'));

    const response = await POST(
      new NextRequest('https://app.test/api/billing/paypal/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PAYPAL_WEBHOOK_CUSTOM_ID_MISSING',
    });
  });
});

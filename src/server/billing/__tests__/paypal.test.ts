import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPayPalOrder,
  getPayPalConfig,
  resolvePayPalWebhookHeaders,
  resetPayPalAccessTokenCacheForTests,
  verifyPayPalWebhookSignature,
} from '@/server/billing/paypal';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  resetPayPalAccessTokenCacheForTests();
  process.env.PAYPAL_CLIENT_ID = 'client-id';
  process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
  process.env.PAYPAL_MODE = 'sandbox';
  process.env.PAYPAL_WEBHOOK_ID = 'webhook-id';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_MODE;
  delete process.env.PAYPAL_WEBHOOK_ID;
});

describe('paypal client', () => {
  it('builds a sandbox config when credentials are present', () => {
    expect(getPayPalConfig()).toMatchObject({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      mode: 'sandbox',
      baseUrl: 'https://api-m.sandbox.paypal.com',
      webhookId: 'webhook-id',
    });
  });

  it('creates a paypal order and exposes the approval url', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-123', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'ORDER-123',
            links: [{ rel: 'approve', href: 'https://paypal.test/approve' }],
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    await expect(
      createPayPalOrder({
        customId: 'local-order-1',
        amountCents: 490,
        description: '50 credits',
        returnUrl: 'https://app.test/return',
        cancelUrl: 'https://app.test/cancel',
      })
    ).resolves.toMatchObject({
      id: 'ORDER-123',
      approvalUrl: 'https://paypal.test/approve',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('verifies a paypal webhook signature using the configured webhook id', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-456', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            verification_status: 'SUCCESS',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    await expect(
      verifyPayPalWebhookSignature({
        event: { event_type: 'CHECKOUT.ORDER.APPROVED' },
        transmissionId: 'tx-id',
        transmissionTime: '2026-03-24T00:00:00Z',
        transmissionSig: 'sig',
        certUrl: 'https://paypal.test/cert',
        authAlgo: 'SHA256withRSA',
      })
    ).resolves.toBe(true);

    expect(resolvePayPalWebhookHeaders(new Headers({
      'paypal-transmission-id': 'tx-id',
      'paypal-transmission-time': '2026-03-24T00:00:00Z',
      'paypal-transmission-sig': 'sig',
      'paypal-cert-url': 'https://paypal.test/cert',
      'paypal-auth-algo': 'SHA256withRSA',
    }))).toEqual({
      transmissionId: 'tx-id',
      transmissionTime: '2026-03-24T00:00:00Z',
      transmissionSig: 'sig',
      certUrl: 'https://paypal.test/cert',
      authAlgo: 'SHA256withRSA',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

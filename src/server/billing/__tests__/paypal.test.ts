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
    const orderRequest = fetchMock.mock.calls[1];
    expect(orderRequest[0]).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders');
    expect(orderRequest[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      }),
    });

    expect(JSON.parse(String(orderRequest[1]?.body))).toMatchObject({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'local-order-1',
          custom_id: 'local-order-1',
          invoice_id: 'local-order-1',
          description: '50 credits',
          amount: {
            currency_code: 'USD',
            value: '4.90',
          },
        },
      ],
      application_context: {
        return_url: 'https://app.test/return',
        cancel_url: 'https://app.test/cancel',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'NovelScript',
      },
    });
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

  it('resolves webhook headers from fallback alias names', () => {
    expect(resolvePayPalWebhookHeaders(new Headers({
      'transmission-id': 'tx-alias',
      'transmission-time': '2026-03-24T00:00:00Z',
      'transmission-sig': 'sig-alias',
      'cert-url': 'https://paypal.test/cert-alias',
      'auth-algo': 'SHA256withRSA',
    }))).toEqual({
      transmissionId: 'tx-alias',
      transmissionTime: '2026-03-24T00:00:00Z',
      transmissionSig: 'sig-alias',
      certUrl: 'https://paypal.test/cert-alias',
      authAlgo: 'SHA256withRSA',
    });
  });

  it('fails fast when webhook verification is attempted without a webhook id', async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;

    await expect(
      verifyPayPalWebhookSignature({
        event: { event_type: 'CHECKOUT.ORDER.APPROVED' },
        transmissionId: 'tx-id',
        transmissionTime: '2026-03-24T00:00:00Z',
        transmissionSig: 'sig',
        certUrl: 'https://paypal.test/cert',
        authAlgo: 'SHA256withRSA',
      })
    ).rejects.toThrow('PAYPAL_WEBHOOK_NOT_CONFIGURED: missing PAYPAL_WEBHOOK_ID');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('times out when paypal token request does not respond', async () => {
    vi.useFakeTimers();
    try {
      process.env.PAYPAL_HTTP_TIMEOUT_MS = '5';
      fetchMock.mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }));

      const orderPromise = createPayPalOrder({
        customId: 'local-order-timeout',
        amountCents: 490,
        description: '50 credits',
        returnUrl: 'https://app.test/return',
        cancelUrl: 'https://app.test/cancel',
      });

      const assertion = expect(orderPromise).rejects.toThrow('PAYPAL_TOKEN_TIMEOUT: 5ms');
      await vi.advanceTimersByTimeAsync(10);
      await assertion;
    } finally {
      vi.useRealTimers();
      delete process.env.PAYPAL_HTTP_TIMEOUT_MS;
    }
  });

  it('wraps paypal network failures with a stable error code', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(
      createPayPalOrder({
        customId: 'local-order-network',
        amountCents: 490,
        description: '50 credits',
        returnUrl: 'https://app.test/return',
        cancelUrl: 'https://app.test/cancel',
      })
    ).rejects.toThrow('PAYPAL_TOKEN_NETWORK_FAILED: fetch failed');
  });
});

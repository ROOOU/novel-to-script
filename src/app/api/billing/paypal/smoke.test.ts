import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  headers: vi.fn(),
  viewer: null as null | {
    organization: { id: string };
    workspace: { id: string };
    user: { id: string; email: string };
    session: { locale: string };
  },
}));

vi.mock('next/headers', () => ({
  headers: () => mocks.headers(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: (...args: unknown[]) => mocks.requireViewerResponse(...args),
}));

describe('paypal billing smoke', () => {
  let previousStorePath: string | undefined;
  let previousApiKey: string | undefined;
  let previousRedisUrl: string | undefined;
  let previousClientId: string | undefined;
  let previousClientSecret: string | undefined;
  let previousMode: string | undefined;
  let previousWebhookId: string | undefined;
  let tempDir: string | null = null;

  beforeEach(() => {
    previousStorePath = process.env.NOVELSCRIPT_STORE_PATH;
    previousApiKey = process.env.LLM_API_KEY;
    previousRedisUrl = process.env.REDIS_URL;
    previousClientId = process.env.PAYPAL_CLIENT_ID;
    previousClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    previousMode = process.env.PAYPAL_MODE;
    previousWebhookId = process.env.PAYPAL_WEBHOOK_ID;
    mocks.viewer = null;
    mocks.requireViewerResponse.mockReset();
    mocks.headers.mockReset();
    mocks.requireViewerResponse.mockImplementation(async () => {
      if (!mocks.viewer) {
        return {
          viewer: null,
          response: new Response(null, { status: 401 }),
        };
      }

      return {
        viewer: mocks.viewer,
        response: null,
      };
    });
    mocks.headers.mockResolvedValue({
      get: vi.fn((key: string) => (key === 'origin' ? 'https://app.test' : null)),
    });
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();

    if (previousStorePath === undefined) {
      delete process.env.NOVELSCRIPT_STORE_PATH;
    } else {
      process.env.NOVELSCRIPT_STORE_PATH = previousStorePath;
    }

    if (previousApiKey === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = previousApiKey;
    }

    if (previousRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousRedisUrl;
    }

    if (previousClientId === undefined) {
      delete process.env.PAYPAL_CLIENT_ID;
    } else {
      process.env.PAYPAL_CLIENT_ID = previousClientId;
    }

    if (previousClientSecret === undefined) {
      delete process.env.PAYPAL_CLIENT_SECRET;
    } else {
      process.env.PAYPAL_CLIENT_SECRET = previousClientSecret;
    }

    if (previousMode === undefined) {
      delete process.env.PAYPAL_MODE;
    } else {
      process.env.PAYPAL_MODE = previousMode;
    }

    if (previousWebhookId === undefined) {
      delete process.env.PAYPAL_WEBHOOK_ID;
    } else {
      process.env.PAYPAL_WEBHOOK_ID = previousWebhookId;
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('creates a credit-pack order, fulfills it through the webhook route, and exposes the credited balance', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-paypal-smoke-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');
    delete process.env.LLM_API_KEY;
    delete process.env.REDIS_URL;
    process.env.PAYPAL_CLIENT_ID = 'client-id';
    process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
    process.env.PAYPAL_MODE = 'sandbox';
    process.env.PAYPAL_WEBHOOK_ID = 'webhook-id';

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'token-123', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.endsWith('/v2/checkout/orders')) {
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-ORDER-123',
            links: [{ rel: 'approve', href: 'https://paypal.test/approve/PAYPAL-ORDER-123' }],
          }),
          {
            status: 201,
            headers: { 'content-type': 'application/json' },
          }
        );
      }

      if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
        return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`UNEXPECTED_FETCH:${url}`);
    });

    vi.resetModules();
    const { getPlatformRuntime } = await import('@/server/shared/platform');
    const { resetPayPalAccessTokenCacheForTests } = await import('@/server/billing/paypal');
    const { POST: createOrder } = await import('@/app/api/billing/paypal/create-order/route');
    const { POST: receiveWebhook } = await import('@/app/api/billing/paypal/webhook/route');
    const { GET: getBillingSummary } = await import('@/app/api/billing/summary/route');

    resetPayPalAccessTokenCacheForTests();
    const runtime = getPlatformRuntime();
    const user = await runtime.users.create({
      email: 'paypal-smoke@example.com',
      displayName: 'PayPal Smoke User',
      preferredLocale: 'zh-CN',
      createdByUserId: null,
    });
    const organization = await runtime.organizations.create({
      slug: 'paypal-smoke-org',
      name: 'PayPal Smoke Org',
      ownerUserId: user.id,
      billingLocale: 'zh-CN',
      billingCurrency: 'USD',
      pricingRegion: 'global',
      createdByUserId: user.id,
    });
    const workspace = await runtime.workspaces.create({
      organizationId: organization.id,
      slug: 'paypal-smoke-workspace',
      name: 'PayPal Smoke Workspace',
      defaultLocale: 'zh-CN',
      createdByUserId: user.id,
    });

    mocks.viewer = {
      organization: { id: organization.id },
      workspace: { id: workspace.id },
      user: { id: user.id, email: user.email },
      session: { locale: 'zh-CN' },
    };

    const createOrderResponse = await createOrder(
      new NextRequest('https://app.test/api/billing/paypal/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          creditPackKey: 'credits-50',
          requestedCurrency: 'USD',
        }),
      })
    );
    expect(createOrderResponse.status).toBe(200);
    const createOrderPayload = await createOrderResponse.json();
    expect(createOrderPayload).toMatchObject({
      ok: true,
      paymentOrderId: expect.any(String),
      providerOrderId: 'PAYPAL-ORDER-123',
      checkout: {
        providerOrderId: 'PAYPAL-ORDER-123',
        approvalUrl: 'https://paypal.test/approve/PAYPAL-ORDER-123',
      },
    });

    const pendingOrders = await runtime.paymentOrders.listByOrganizationId(organization.id);
    expect(pendingOrders).toHaveLength(1);
    expect(pendingOrders[0]).toMatchObject({
      status: 'pending',
      purchaseKind: 'credit-pack',
      providerOrderId: 'PAYPAL-ORDER-123',
    });

    const webhookResponse = await receiveWebhook(
      new NextRequest('https://app.test/api/billing/paypal/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'paypal-transmission-id': 'tx-1',
          'paypal-transmission-time': '2026-03-24T00:00:00Z',
          'paypal-transmission-sig': 'sig-1',
          'paypal-cert-url': 'https://paypal.test/cert.pem',
          'paypal-auth-algo': 'SHA256withRSA',
        },
        body: JSON.stringify({
          event_type: 'CHECKOUT.ORDER.COMPLETED',
          resource: {
            custom_id: createOrderPayload.paymentOrderId,
            id: 'PAYPAL-CAPTURE-123',
          },
        }),
      })
    );
    expect(webhookResponse.status).toBe(200);
    await expect(webhookResponse.json()).resolves.toMatchObject({
      ok: true,
      received: true,
      result: {
        ok: true,
        action: 'order_fulfilled',
      },
    });

    const summaryResponse = await getBillingSummary();
    expect(summaryResponse.status).toBe(200);
    const summaryPayload = await summaryResponse.json();
    expect(summaryPayload).toMatchObject({
      ok: true,
      creditAccount: {
        organizationId: organization.id,
        availableCredits: 50,
        consumedCreditsTotal: 0,
        reservedCredits: 0,
      },
    });
    expect(summaryPayload.paymentOrders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pendingOrders[0].id,
          status: 'paid',
          providerOrderId: 'PAYPAL-CAPTURE-123',
        }),
      ])
    );
    expect(summaryPayload.ledgerEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'pack_purchase',
          paymentOrderId: pendingOrders[0].id,
        }),
      ])
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

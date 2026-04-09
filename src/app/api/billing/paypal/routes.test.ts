import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  headers: vi.fn(),
  createCreditPackCheckout: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  capturePaymentOrder: vi.fn(),
  findPaymentOrderByProviderOrderId: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: () => mocks.headers(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/billing/payments', () => ({
  createCreditPackCheckout: (...args: unknown[]) => mocks.createCreditPackCheckout(...args),
  createSubscriptionCheckout: (...args: unknown[]) => mocks.createSubscriptionCheckout(...args),
  capturePaymentOrder: (...args: unknown[]) => mocks.capturePaymentOrder(...args),
  findPaymentOrderByProviderOrderId: (...args: unknown[]) => mocks.findPaymentOrderByProviderOrderId(...args),
}));

import { POST as createOrder } from '@/app/api/billing/paypal/create-order/route';
import { POST as createSubscription } from '@/app/api/billing/paypal/create-subscription/route';
import { POST as captureOrder } from '@/app/api/billing/paypal/capture-order/route';

describe('paypal billing routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerResponse.mockResolvedValue({
      viewer: {
        organization: { id: 'org_1' },
        user: { id: 'user_1', email: 'creator@example.com' },
        session: { locale: 'zh-CN' },
      },
      response: null,
    });
    mocks.headers.mockResolvedValue({
      get: vi.fn((key: string) => (key === 'origin' ? 'https://headers.test' : null)),
    });
    mocks.createCreditPackCheckout.mockResolvedValue({
      order: {
        id: 'payment_order_1',
      },
      approvalUrl: 'https://paypal.test/order',
      providerOrderId: 'provider-order-1',
      mode: 'paypal',
    });
    mocks.createSubscriptionCheckout.mockResolvedValue({
      approvalUrl: 'https://paypal.test/subscription',
      providerOrderId: 'provider-subscription-1',
      mode: 'paypal',
    });
    mocks.capturePaymentOrder.mockResolvedValue({
      id: 'payment_order_1',
      status: 'paid',
    });
    mocks.findPaymentOrderByProviderOrderId.mockResolvedValue({
      id: 'payment_order_1',
      organizationId: 'org_1',
    });
  });

  it('rejects blank credit pack keys before checkout creation', async () => {
    const response = await createOrder(
      new NextRequest('https://app.test/api/billing/paypal/create-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          creditPackKey: '',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.createCreditPackCheckout).not.toHaveBeenCalled();
  });

  it('creates credit-pack checkouts with the resolved origin', async () => {
    const response = await createOrder(
      new NextRequest('https://app.test/api/billing/paypal/create-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          creditPackKey: 'credits-50',
          requestedCurrency: 'USD',
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      paymentOrderId: 'payment_order_1',
      providerOrderId: 'provider-order-1',
      checkout: {
        approvalUrl: 'https://paypal.test/order',
      },
    });
    expect(mocks.createCreditPackCheckout).toHaveBeenCalledWith({
      organizationId: 'org_1',
      userId: 'user_1',
      email: 'creator@example.com',
      locale: 'zh-CN',
      origin: 'https://app.test',
      creditPackKey: 'credits-50',
      requestedCurrency: 'USD',
    });
  });

  it('maps credit-pack checkout failures to 400', async () => {
    mocks.createCreditPackCheckout.mockRejectedValueOnce(new Error('PAYPAL_ORDER_CREATE_FAILED'));

    const response = await createOrder(
      new NextRequest('https://app.test/api/billing/paypal/create-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          creditPackKey: 'credits-50',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PAYPAL_ORDER_CREATE_FAILED',
    });
  });

  it('maps paypal create-order timeouts to 504', async () => {
    mocks.createCreditPackCheckout.mockRejectedValueOnce(new Error('PAYPAL_V2_CHECKOUT_ORDERS_TIMEOUT: 15000ms'));

    const response = await createOrder(
      new NextRequest('https://app.test/api/billing/paypal/create-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          creditPackKey: 'credits-50',
        }),
      })
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PAYPAL_V2_CHECKOUT_ORDERS_TIMEOUT: 15000ms',
    });
  });

  it('rejects blank plan keys before subscription checkout creation', async () => {
    const response = await createSubscription(
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
    expect(mocks.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('creates subscription checkouts with the resolved origin', async () => {
    const response = await createSubscription(
      new NextRequest('https://app.test/api/billing/paypal/create-subscription', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          planKey: 'pro',
          requestedCurrency: 'USD',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.createSubscriptionCheckout).toHaveBeenCalledWith({
      organizationId: 'org_1',
      userId: 'user_1',
      email: 'creator@example.com',
      locale: 'zh-CN',
      origin: 'https://app.test',
      planKey: 'pro',
      requestedCurrency: 'USD',
    });
  });

  it('maps subscription checkout failures to 400', async () => {
    mocks.createSubscriptionCheckout.mockRejectedValueOnce(new Error('PAYPAL_SUBSCRIPTION_CREATE_FAILED'));

    const response = await createSubscription(
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

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PAYPAL_SUBSCRIPTION_CREATE_FAILED',
    });
  });

  it('rejects capture requests without either identifier', async () => {
    const response = await captureOrder(
      new NextRequest('https://app.test/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.findPaymentOrderByProviderOrderId).not.toHaveBeenCalled();
    expect(mocks.capturePaymentOrder).not.toHaveBeenCalled();
  });

  it('returns 404 when provider order lookup misses', async () => {
    mocks.findPaymentOrderByProviderOrderId.mockResolvedValueOnce(null);

    const response = await captureOrder(
      new NextRequest('https://app.test/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          providerOrderId: 'paypal-provider-order',
        }),
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PAYMENT_ORDER_NOT_FOUND',
    });
  });

  it('captures by provider order id after lookup', async () => {
    const response = await captureOrder(
      new NextRequest('https://app.test/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          providerOrderId: 'paypal-provider-order',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.findPaymentOrderByProviderOrderId).toHaveBeenCalledWith('org_1', 'paypal-provider-order');
    expect(mocks.capturePaymentOrder).toHaveBeenCalledWith('payment_order_1');
  });

  it('captures directly by paymentOrderId without lookup', async () => {
    const response = await captureOrder(
      new NextRequest('https://app.test/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          paymentOrderId: 'payment_order_direct',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.findPaymentOrderByProviderOrderId).not.toHaveBeenCalled();
    expect(mocks.capturePaymentOrder).toHaveBeenCalledWith('payment_order_direct');
  });

  it('maps capture failures to 400', async () => {
    mocks.capturePaymentOrder.mockRejectedValueOnce(new Error('PAYPAL_CAPTURE_FAILED'));

    const response = await captureOrder(
      new NextRequest('https://app.test/api/billing/paypal/capture-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          paymentOrderId: 'payment_order_direct',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PAYPAL_CAPTURE_FAILED',
    });
  });
});

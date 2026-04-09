import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatformRuntime: vi.fn(),
  getOrCreateCreditAccount: vi.fn(),
  grantCredits: vi.fn(),
  createPayPalOrder: vi.fn(),
  createPayPalSubscription: vi.fn(),
  capturePayPalOrder: vi.fn(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: mocks.getPlatformRuntime,
}));

vi.mock('@/server/billing/service', () => ({
  getOrCreateCreditAccount: mocks.getOrCreateCreditAccount,
  grantCredits: mocks.grantCredits,
}));

vi.mock('@/server/billing/paypal', () => ({
  createPayPalOrder: mocks.createPayPalOrder,
  createPayPalSubscription: mocks.createPayPalSubscription,
  capturePayPalOrder: mocks.capturePayPalOrder,
}));

import {
  capturePaymentOrder,
  createCreditPackCheckout,
  createSubscriptionCheckout,
  fulfillPaymentOrder,
  handlePayPalWebhook,
} from '@/server/billing/payments';

function createRuntimeMock() {
  return {
    paymentOrders: {
      create: vi.fn(),
      update: vi.fn(),
      getById: vi.fn(),
      listByOrganizationId: vi.fn(),
    },
    subscriptions: {
      upsertCurrent: vi.fn(),
      getCurrentByOrganizationId: vi.fn(),
      update: vi.fn(),
    },
    creditLedger: {
      append: vi.fn(),
    },
  };
}

describe('billing/payments orchestration', () => {
  let runtime: ReturnType<typeof createRuntimeMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    runtime = createRuntimeMock();
    mocks.getPlatformRuntime.mockReturnValue(runtime);
    mocks.getOrCreateCreditAccount.mockResolvedValue({
      id: 'credit-account-1',
      organizationId: 'org-1',
      availableCredits: 0,
      reservedCredits: 0,
      grantedCreditsTotal: 0,
      consumedCreditsTotal: 0,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: null,
      updatedByUserId: null,
    });
    mocks.grantCredits.mockResolvedValue({
      account: { id: 'credit-account-1' },
      ledgerEntry: { id: 'ledger-1' },
    });
    mocks.createPayPalOrder.mockResolvedValue({
      id: 'paypal-order-1',
      approvalUrl: 'https://paypal.test/approve',
      raw: {},
    });
    mocks.createPayPalSubscription.mockResolvedValue({
      id: 'paypal-subscription-1',
      approvalUrl: 'https://paypal.test/subscription-approve',
      raw: {},
    });
    mocks.capturePayPalOrder.mockResolvedValue({
      id: 'paypal-capture-1',
      status: 'COMPLETED',
      payer: { payer_id: 'payer-1' },
    });
    process.env.PAYPAL_PLAN_ID = 'plan-default';
  });

  afterEach(() => {
    delete process.env.PAYPAL_PLAN_ID;
  });

  it('creates a paypal checkout order for credit packs', async () => {
    runtime.paymentOrders.create.mockResolvedValue({
      id: 'order-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'pending',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: null,
      providerSubscriptionId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: { locale: 'zh-CN' },
    });
    runtime.paymentOrders.update.mockResolvedValue({
      id: 'order-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'pending',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: 'paypal-order-1',
      providerSubscriptionId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: { paypalApprovalUrl: 'https://paypal.test/approve' },
    });

    const result = await createCreditPackCheckout({
      organizationId: 'org-1',
      userId: 'user-1',
      email: 'creator@example.com',
      locale: 'zh-CN',
      origin: 'https://app.test',
      creditPackKey: 'credits-50' as any,
      requestedCurrency: 'USD',
    });

    expect(mocks.createPayPalOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customId: 'order-1',
        returnUrl: 'https://app.test/zh-CN/billing?checkout=success&purchaseKind=credit-pack&paymentOrderId=order-1',
        cancelUrl: 'https://app.test/zh-CN/pricing?checkout=cancelled&purchaseKind=credit-pack',
      })
    );
    expect(runtime.paymentOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'paypal',
        currency: 'USD',
        metadata: expect.objectContaining({
          requestedCurrency: 'USD',
          purchaseKind: 'credit-pack',
        }),
      })
    );
    expect(result).toMatchObject({
      approvalUrl: 'https://paypal.test/approve',
      providerOrderId: 'paypal-order-1',
      mode: 'paypal',
    });
  });

  it('marks credit-pack orders as failed when paypal order creation fails', async () => {
    runtime.paymentOrders.create.mockResolvedValue({
      id: 'order-failed-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'pending',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: null,
      providerSubscriptionId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: { locale: 'zh-CN' },
    });
    runtime.paymentOrders.update.mockResolvedValue({
      id: 'order-failed-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'failed',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: null,
      providerSubscriptionId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: {
        locale: 'zh-CN',
        payPalError: 'PAYPAL_ORDER_CREATE_FAILED',
      },
    });
    mocks.createPayPalOrder.mockRejectedValueOnce(new Error('PAYPAL_ORDER_CREATE_FAILED'));

    await expect(
      createCreditPackCheckout({
        organizationId: 'org-1',
        userId: 'user-1',
        email: 'creator@example.com',
        locale: 'zh-CN',
        origin: 'https://app.test',
        creditPackKey: 'credits-50' as any,
        requestedCurrency: 'USD',
      })
    ).rejects.toThrow('PAYPAL_ORDER_CREATE_FAILED');

    expect(runtime.paymentOrders.update).toHaveBeenCalledWith(
      'order-failed-1',
      expect.objectContaining({
        status: 'failed',
        metadata: expect.objectContaining({
          payPalError: 'PAYPAL_ORDER_CREATE_FAILED',
        }),
      })
    );
  });

  it('creates a paypal subscription checkout with a mapped plan id', async () => {
    runtime.paymentOrders.create.mockResolvedValue({
      id: 'sub-order-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'subscription',
      status: 'pending',
      planKey: 'pro',
      creditPackKey: null,
      amountCents: 2900,
      currency: 'USD',
      creditsGranted: 600,
      providerOrderId: null,
      providerSubscriptionId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: { locale: 'zh-CN' },
    });
    runtime.paymentOrders.update.mockResolvedValue({
      id: 'sub-order-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'subscription',
      status: 'pending',
      planKey: 'pro',
      creditPackKey: null,
      amountCents: 2900,
      currency: 'USD',
      creditsGranted: 600,
      providerOrderId: 'paypal-subscription-1',
      providerSubscriptionId: 'paypal-subscription-1',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: { paypalApprovalUrl: 'https://paypal.test/subscription-approve' },
    });

    const result = await createSubscriptionCheckout({
      organizationId: 'org-1',
      userId: 'user-1',
      email: 'creator@example.com',
      locale: 'zh-CN',
      origin: 'https://app.test',
      planKey: 'pro' as any,
      requestedCurrency: 'USD',
    });

    expect(mocks.createPayPalSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        customId: 'sub-order-1',
        planId: 'plan-default',
        returnUrl: 'https://app.test/zh-CN/billing?checkout=success&purchaseKind=subscription&paymentOrderId=sub-order-1',
        cancelUrl: 'https://app.test/zh-CN/pricing?checkout=cancelled&purchaseKind=subscription',
      })
    );
    expect(result).toMatchObject({
      approvalUrl: 'https://paypal.test/subscription-approve',
      providerOrderId: 'paypal-subscription-1',
      mode: 'paypal',
    });
  });

  it('fulfills subscription payment orders and grants credits', async () => {
    runtime.paymentOrders.getById.mockResolvedValue({
      id: 'order-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'subscription',
      status: 'pending',
      planKey: 'pro',
      creditPackKey: null,
      amountCents: 2900,
      currency: 'USD',
      creditsGranted: 600,
      providerOrderId: 'paypal-subscription-1',
      providerSubscriptionId: 'paypal-subscription-1',
      providerCustomerId: 'payer-1',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: {},
    });
    runtime.paymentOrders.update.mockResolvedValue({
      id: 'order-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'subscription',
      status: 'paid',
      planKey: 'pro',
      creditPackKey: null,
      amountCents: 2900,
      currency: 'USD',
      creditsGranted: 600,
      providerOrderId: 'paypal-subscription-1',
      providerSubscriptionId: 'paypal-subscription-1',
      providerCustomerId: 'payer-1',
      paidAt: '2026-03-24T01:00:00.000Z',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T01:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: {},
    });
    runtime.subscriptions.upsertCurrent.mockResolvedValue({
      id: 'subscription-1',
    });

    const result = await fulfillPaymentOrder('order-1');

    expect(runtime.subscriptions.upsertCurrent).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        provider: 'paypal',
        providerSubscriptionId: 'paypal-subscription-1',
        currency: 'USD',
      })
    );
    expect(mocks.grantCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'subscription_grant',
        credits: 600,
        paymentOrderId: 'order-1',
      })
    );
    expect(result).toMatchObject({
      status: 'paid',
      providerSubscriptionId: 'paypal-subscription-1',
    });
  });

  it('returns paid orders idempotently without re-granting credits', async () => {
    const paidOrder = {
      id: 'order-paid-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'paid',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: 'paypal-order-paid',
      providerSubscriptionId: null,
      providerCustomerId: 'payer-1',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T01:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: {},
    };
    runtime.paymentOrders.getById.mockResolvedValue(paidOrder);

    const result = await fulfillPaymentOrder('order-paid-1');

    expect(result).toBe(paidOrder);
    expect(runtime.paymentOrders.update).not.toHaveBeenCalled();
    expect(runtime.subscriptions.upsertCurrent).not.toHaveBeenCalled();
    expect(mocks.grantCredits).not.toHaveBeenCalled();
  });

  it('returns already-paid orders without regranting credits', async () => {
    runtime.paymentOrders.getById.mockResolvedValue({
      id: 'order-paid-1',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'paid',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: 'paypal-order-1',
      providerSubscriptionId: null,
      providerCustomerId: 'payer-1',
      paidAt: '2026-03-24T01:00:00.000Z',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T01:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: {},
    });

    const result = await fulfillPaymentOrder('order-paid-1');

    expect(result).toMatchObject({
      id: 'order-paid-1',
      status: 'paid',
    });
    expect(runtime.paymentOrders.update).not.toHaveBeenCalled();
    expect(runtime.subscriptions.upsertCurrent).not.toHaveBeenCalled();
    expect(mocks.grantCredits).not.toHaveBeenCalled();
  });

  it('captures paypal orders before fulfilling credit pack purchases', async () => {
    runtime.paymentOrders.getById.mockResolvedValue({
      id: 'order-2',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'pending',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: 'paypal-order-1',
      providerSubscriptionId: null,
      providerCustomerId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: {},
    });
    runtime.paymentOrders.update.mockResolvedValue({
      id: 'order-2',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'paid',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: 'paypal-order-1',
      providerSubscriptionId: null,
      providerCustomerId: 'payer-1',
      paidAt: '2026-03-24T01:00:00.000Z',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T01:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: {},
    });

    const result = await capturePaymentOrder('order-2');

    expect(mocks.capturePayPalOrder).toHaveBeenCalledWith('paypal-order-1');
    expect(mocks.grantCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'pack_purchase',
        credits: 50,
        paymentOrderId: 'order-2',
      })
    );
    expect(result).toMatchObject({
      status: 'paid',
      providerCustomerId: 'payer-1',
    });
  });

  it('fails capture requests when the provider order id is missing', async () => {
    runtime.paymentOrders.getById.mockResolvedValue({
      id: 'order-3',
      organizationId: 'org-1',
      provider: 'paypal',
      purchaseKind: 'credit-pack',
      status: 'pending',
      planKey: null,
      creditPackKey: 'credits-50',
      amountCents: 490,
      currency: 'USD',
      creditsGranted: 50,
      providerOrderId: null,
      providerSubscriptionId: null,
      providerCustomerId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      metadata: {},
    });

    await expect(capturePaymentOrder('order-3')).rejects.toThrow('PAYPAL_PROVIDER_ORDER_ID_MISSING');

    expect(mocks.capturePayPalOrder).not.toHaveBeenCalled();
    expect(runtime.paymentOrders.update).not.toHaveBeenCalled();
    expect(mocks.grantCredits).not.toHaveBeenCalled();
  });


  describe('handlePayPalWebhook', () => {
    it('fulfills order on CHECKOUT.ORDER.APPROVED', async () => {
      runtime.paymentOrders.getById.mockResolvedValue({
        id: 'order-pack-1',
        organizationId: 'org-1',
        provider: 'paypal',
        purchaseKind: 'credit-pack',
        status: 'pending',
        planKey: null,
        creditPackKey: 'credits-50',
        amountCents: 490,
        currency: 'USD',
        creditsGranted: 50,
        providerOrderId: 'paypal-order-id-123',
        providerSubscriptionId: null,
        providerCustomerId: null,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        metadata: {},
      });
      runtime.paymentOrders.update.mockResolvedValue({
        id: 'order-pack-1',
        organizationId: 'org-1',
        provider: 'paypal',
        purchaseKind: 'credit-pack',
        status: 'paid',
        planKey: null,
        creditPackKey: 'credits-50',
        amountCents: 490,
        currency: 'USD',
        creditsGranted: 50,
        providerOrderId: 'paypal-order-id-123',
        providerSubscriptionId: null,
        providerCustomerId: null,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        metadata: {},
      });

      const result = await handlePayPalWebhook({
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: {
          custom_id: 'order-pack-1',
          id: 'paypal-order-id-123'
        }
      });

      expect(result.action).toBe('order_fulfilled');
      expect(mocks.grantCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'pack_purchase',
          paymentOrderId: 'order-pack-1',
        })
      );
    });

    it('fulfills subscription on BILLING.SUBSCRIPTION.ACTIVATED', async () => {
      runtime.paymentOrders.getById.mockResolvedValue({
        id: 'order-sub-1',
        organizationId: 'org-1',
        provider: 'paypal',
        purchaseKind: 'subscription',
        status: 'pending',
        planKey: 'pro',
        creditPackKey: null,
        amountCents: 2900,
        currency: 'USD',
        creditsGranted: 600,
        providerOrderId: 'sub-paypal-123',
        providerSubscriptionId: null,
        providerCustomerId: null,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        metadata: {},
      });
      runtime.paymentOrders.update.mockResolvedValue({
        id: 'order-sub-1',
        organizationId: 'org-1',
        provider: 'paypal',
        purchaseKind: 'subscription',
        status: 'paid',
        planKey: 'pro',
        creditPackKey: null,
        amountCents: 2900,
        currency: 'USD',
        creditsGranted: 600,
        providerOrderId: 'sub-paypal-123',
        providerSubscriptionId: null,
        providerCustomerId: null,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        metadata: {},
      });
      runtime.subscriptions.upsertCurrent.mockResolvedValue({ id: 'sub-1' });

      const result = await handlePayPalWebhook({
        event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
        resource: {
          custom_id: 'order-sub-1',
          id: 'sub-paypal-123'
        }
      });

      expect(result.action).toBe('subscription_activated');
      expect(runtime.subscriptions.upsertCurrent).toHaveBeenCalled();
      expect(mocks.grantCredits).toHaveBeenCalled();
    });

    it('cancels subscription on BILLING.SUBSCRIPTION.CANCELLED', async () => {
      runtime.paymentOrders.getById.mockResolvedValue({
        id: 'order-sub-2',
        organizationId: 'org-1',
        provider: 'paypal',
        purchaseKind: 'subscription',
        status: 'paid',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        metadata: {},
      });
      runtime.subscriptions.getCurrentByOrganizationId.mockResolvedValue({
        id: 'sub-1',
        organizationId: 'org-1'
      });

      const result = await handlePayPalWebhook({
        event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
        resource: {
          custom_id: 'order-sub-2',
          id: 'sub-paypal-123'
        }
      });

      expect(result.action).toBe('subscription_cancelled');
      expect(runtime.subscriptions.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({
        status: 'canceled'
      }));
    });

    it('fulfills capture events using purchase_units custom ids and related order ids', async () => {
      runtime.paymentOrders.getById.mockResolvedValue({
        id: 'order-pack-2',
        organizationId: 'org-1',
        provider: 'paypal',
        purchaseKind: 'credit-pack',
        status: 'pending',
        planKey: null,
        creditPackKey: 'credits-50',
        amountCents: 490,
        currency: 'USD',
        creditsGranted: 50,
        providerOrderId: 'paypal-order-fallback',
        providerSubscriptionId: null,
        providerCustomerId: null,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        metadata: {},
      });
      runtime.paymentOrders.update.mockResolvedValue({
        id: 'order-pack-2',
        organizationId: 'org-1',
        provider: 'paypal',
        purchaseKind: 'credit-pack',
        status: 'paid',
        planKey: null,
        creditPackKey: 'credits-50',
        amountCents: 490,
        currency: 'USD',
        creditsGranted: 50,
        providerOrderId: 'paypal-order-fallback',
        providerSubscriptionId: null,
        providerCustomerId: null,
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        metadata: {},
      });

      const result = await handlePayPalWebhook({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          purchase_units: [
            {
              custom_id: 'order-pack-2',
            },
          ],
          supplementary_data: {
            related_ids: {
              order_id: 'paypal-order-fallback',
            },
          },
        },
      });

      expect(result).toMatchObject({
        ok: true,
        action: 'capture_fulfilled',
      });
      expect(runtime.paymentOrders.update).toHaveBeenCalledWith(
        'order-pack-2',
        expect.objectContaining({
          providerOrderId: 'paypal-order-fallback',
          status: 'paid',
        })
      );
      expect(mocks.grantCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'pack_purchase',
          paymentOrderId: 'order-pack-2',
        })
      );
    });

    it('throws when fulfillment webhook events are missing a payment order id', async () => {
      await expect(
        handlePayPalWebhook({
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'capture-only-1',
          },
        })
      ).rejects.toThrow('PAYPAL_WEBHOOK_CUSTOM_ID_MISSING');

      expect(runtime.paymentOrders.getById).not.toHaveBeenCalled();
      expect(runtime.paymentOrders.update).not.toHaveBeenCalled();
      expect(mocks.grantCredits).not.toHaveBeenCalled();
    });

    it('cancels subscriptions for suspended webhook events and records the source event', async () => {
      runtime.paymentOrders.getById.mockResolvedValue({
        id: 'order-sub-3',
        organizationId: 'org-1',
        provider: 'paypal',
        purchaseKind: 'subscription',
        status: 'paid',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        metadata: {},
      });
      runtime.subscriptions.getCurrentByOrganizationId.mockResolvedValue({
        id: 'sub-3',
        organizationId: 'org-1',
      });
      runtime.paymentOrders.update.mockResolvedValue({
        id: 'order-sub-3',
      });

      const result = await handlePayPalWebhook({
        event_type: 'BILLING.SUBSCRIPTION.SUSPENDED',
        resource: {
          custom_id: 'order-sub-3',
        },
      });

      expect(result).toEqual({
        ok: true,
        action: 'subscription_cancelled',
      });
      expect(runtime.subscriptions.update).toHaveBeenCalledWith(
        'sub-3',
        expect.objectContaining({
          status: 'canceled',
        })
      );
      expect(runtime.paymentOrders.update).toHaveBeenCalledWith(
        'order-sub-3',
        expect.objectContaining({
          metadata: expect.objectContaining({
            webhookEventType: 'BILLING.SUBSCRIPTION.SUSPENDED',
          }),
        })
      );
    });

    it('ignores unsupported webhook event types without touching payment state', async () => {
      const result = await handlePayPalWebhook({
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          id: 'capture-denied-1',
        },
      });

      expect(result).toEqual({
        ok: true,
        action: 'ignored',
      });
      expect(runtime.paymentOrders.getById).not.toHaveBeenCalled();
      expect(runtime.paymentOrders.update).not.toHaveBeenCalled();
      expect(runtime.subscriptions.update).not.toHaveBeenCalled();
      expect(mocks.grantCredits).not.toHaveBeenCalled();
    });
  });
});

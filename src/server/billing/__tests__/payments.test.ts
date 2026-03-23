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
});

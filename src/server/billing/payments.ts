import {
  buildCreditPackPurchase,
  buildSubscriptionPurchase,
  getCreditPackCatalogEntry,
  getPlanCatalogEntry,
  getPlanEntitlements,
  type CreditPackKey,
  type PlanKey,
} from '@/server/billing/catalog';
import { grantCredits, getOrCreateCreditAccount } from '@/server/billing/service';
import {
  capturePayPalOrder,
  createPayPalOrder,
  createPayPalSubscription,
  type PayPalApprovalResult,
} from '@/server/billing/paypal';
import { getPlatformRuntime } from '@/server/shared/platform';

type CheckoutPurchaseKind = 'subscription' | 'credit-pack';

export async function getBillingSummary(organizationId: string) {
  const runtime = getPlatformRuntime();
  const [subscription, creditAccount, paymentOrders, ledgerEntries] = await Promise.all([
    runtime.subscriptions.getCurrentByOrganizationId(organizationId),
    getOrCreateCreditAccount(organizationId),
    runtime.paymentOrders.listByOrganizationId(organizationId),
    runtime.creditLedger.listByOrganizationId(organizationId),
  ]);

  return {
    subscription,
    creditAccount,
    paymentOrders: paymentOrders.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    ledgerEntries: ledgerEntries.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

export async function createCheckoutOrder(input: {
  organizationId: string;
  userId: string;
  email: string;
  locale: string;
  origin: string;
  purchaseKind: CheckoutPurchaseKind;
  planKey?: string;
  creditPackKey?: string;
  requestedCurrency?: string;
}) {
  return input.purchaseKind === 'subscription'
    ? createSubscriptionCheckout({
        organizationId: input.organizationId,
        userId: input.userId,
        email: input.email,
        locale: input.locale,
        origin: input.origin,
        planKey: input.planKey as PlanKey,
        requestedCurrency: input.requestedCurrency,
      })
    : createCreditPackCheckout({
        organizationId: input.organizationId,
        userId: input.userId,
        email: input.email,
        locale: input.locale,
        origin: input.origin,
        creditPackKey: input.creditPackKey as CreditPackKey,
        requestedCurrency: input.requestedCurrency,
      });
}

export async function createSubscriptionCheckout(input: {
  organizationId: string;
  userId: string;
  email: string;
  locale: string;
  origin: string;
  planKey: PlanKey;
  requestedCurrency?: string;
}) {
  const runtime = getPlatformRuntime();
  const purchase = buildSubscriptionPurchase(input.planKey, 'USD', 'paypal');
  const order = await runtime.paymentOrders.create({
    organizationId: input.organizationId,
    provider: 'paypal',
    purchaseKind: 'subscription',
    planKey: purchase.planKey,
    amountCents: purchase.amountCents,
    currency: purchase.currency,
    creditsGranted: purchase.creditsGranted,
    status: 'pending',
    providerOrderId: null,
    providerSubscriptionId: null,
    createdByUserId: input.userId,
    metadata: {
      locale: input.locale,
      requestedCurrency: input.requestedCurrency ?? 'USD',
      purchaseKind: 'subscription',
    },
  });

  const approval = await createPayPalSubscriptionWithPlan({
    orderId: order.id,
    planKey: input.planKey,
    email: input.email,
    origin: input.origin,
    locale: input.locale,
  }).catch(async (error) => {
    await runtime.paymentOrders.update(order.id, {
      status: 'failed',
      metadata: {
        ...order.metadata,
        payPalError: error instanceof Error ? error.message : 'PAYPAL_SUBSCRIPTION_CREATE_FAILED',
      },
      updatedByUserId: input.userId,
    });
    throw error;
  });

  const updatedOrder = await runtime.paymentOrders.update(order.id, {
    status: 'pending',
    providerOrderId: approval.id,
    providerSubscriptionId: approval.id,
    metadata: {
      ...order.metadata,
      paypalApprovalUrl: approval.approvalUrl,
      payPalSubscriptionId: approval.id,
    },
    updatedByUserId: input.userId,
  });

  return {
    order: updatedOrder,
    approvalUrl: approval.approvalUrl,
    providerOrderId: approval.id,
    mode: 'paypal' as const,
  };
}

export async function createCreditPackCheckout(input: {
  organizationId: string;
  userId: string;
  email: string;
  locale: string;
  origin: string;
  creditPackKey: CreditPackKey;
  requestedCurrency?: string;
}) {
  const runtime = getPlatformRuntime();
  const purchase = buildCreditPackPurchase(input.creditPackKey, 'USD', 'paypal');
  const order = await runtime.paymentOrders.create({
    organizationId: input.organizationId,
    provider: 'paypal',
    purchaseKind: 'credit-pack',
    creditPackKey: purchase.creditPackKey,
    amountCents: purchase.amountCents,
    currency: purchase.currency,
    creditsGranted: purchase.creditsGranted,
    status: 'pending',
    providerOrderId: null,
    providerSubscriptionId: null,
    createdByUserId: input.userId,
    metadata: {
      locale: input.locale,
      requestedCurrency: input.requestedCurrency ?? 'USD',
      purchaseKind: 'credit-pack',
    },
  });

  const approval = await createPayPalOrderWithPaymentOrder({
    orderId: order.id,
    purchase,
    origin: input.origin,
    locale: input.locale,
  }).catch(async (error) => {
    await runtime.paymentOrders.update(order.id, {
      status: 'failed',
      metadata: {
        ...order.metadata,
        payPalError: error instanceof Error ? error.message : 'PAYPAL_ORDER_CREATE_FAILED',
      },
      updatedByUserId: input.userId,
    });
    throw error;
  });

  const updatedOrder = await runtime.paymentOrders.update(order.id, {
    status: 'pending',
    providerOrderId: approval.id,
    metadata: {
      ...order.metadata,
      paypalApprovalUrl: approval.approvalUrl,
      payPalOrderId: approval.id,
    },
    updatedByUserId: input.userId,
  });

  return {
    order: updatedOrder,
    approvalUrl: approval.approvalUrl,
    providerOrderId: approval.id,
    mode: 'paypal' as const,
  };
}

export async function createBillingPortalSession() {
  throw new Error('PAYPAL_BILLING_PORTAL_NOT_SUPPORTED');
}

export async function fulfillPaymentOrder(
  orderId: string,
  overrides?: {
    providerCustomerId?: string | null;
    providerSubscriptionId?: string | null;
    providerOrderId?: string | null;
  }
) {
  const runtime = getPlatformRuntime();
  const order = await runtime.paymentOrders.getById(orderId);
  if (!order) {
    throw new Error('PAYMENT_ORDER_NOT_FOUND');
  }

  if (order.status === 'paid') {
    return order;
  }

  const updatedOrder = await runtime.paymentOrders.update(order.id, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    providerCustomerId: overrides?.providerCustomerId ?? order.providerCustomerId,
    providerSubscriptionId: overrides?.providerSubscriptionId ?? order.providerSubscriptionId,
    providerOrderId: overrides?.providerOrderId ?? order.providerOrderId,
    updatedByUserId: order.updatedByUserId ?? order.createdByUserId ?? null,
  });

  if (updatedOrder.purchaseKind === 'subscription' && updatedOrder.planKey) {
    const plan = getPlanCatalogEntry(updatedOrder.planKey as PlanKey);
    await runtime.subscriptions.upsertCurrent(updatedOrder.organizationId, {
      organizationId: updatedOrder.organizationId,
      provider: 'paypal',
      providerCustomerId: updatedOrder.providerCustomerId,
      providerSubscriptionId: updatedOrder.providerSubscriptionId ?? updatedOrder.providerOrderId ?? null,
      providerPriceId: null,
      planKey: plan.key,
      status: 'active',
      billingInterval: plan.billingInterval,
      entitlements: getPlanEntitlements(plan.key),
      priceCents: plan.prices.USD.amountCents,
      currency: 'USD',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdByUserId: updatedOrder.updatedByUserId ?? null,
    });

    await grantCredits({
      organizationId: updatedOrder.organizationId,
      userId: updatedOrder.updatedByUserId ?? null,
      credits: updatedOrder.creditsGranted ?? plan.monthlyCredits,
      kind: 'subscription_grant',
      paymentOrderId: updatedOrder.id,
      note: `${plan.key} subscription grant`,
    });
  }

  if (updatedOrder.purchaseKind === 'credit-pack') {
    await grantCredits({
      organizationId: updatedOrder.organizationId,
      userId: updatedOrder.updatedByUserId ?? null,
      credits: updatedOrder.creditsGranted ?? 0,
      kind: 'pack_purchase',
      paymentOrderId: updatedOrder.id,
      note: `${updatedOrder.creditPackKey ?? 'credit-pack'} purchase`,
    });
  }

  return updatedOrder;
}

export async function handlePayPalWebhook(event: Record<string, unknown>) {
  const eventType = String(event.event_type ?? event.type ?? '').toUpperCase();
  const resource = extractWebhookResource(event);
  const customId = extractCustomId(resource);
  const subscriptionId = extractSubscriptionId(resource);
  const captureId = extractCaptureId(resource);

  if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'CHECKOUT.ORDER.COMPLETED') {
    if (!customId) {
      throw new Error('PAYPAL_WEBHOOK_CUSTOM_ID_MISSING');
    }
    await fulfillPaymentOrder(customId, {
      providerOrderId: captureId ?? customId,
    });
    return { ok: true, action: 'order_fulfilled' as const };
  }

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    if (!customId) {
      throw new Error('PAYPAL_WEBHOOK_CUSTOM_ID_MISSING');
    }
    await fulfillPaymentOrder(customId, {
      providerOrderId: captureId ?? customId,
    });
    return { ok: true, action: 'capture_fulfilled' as const };
  }

  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    if (!customId) {
      throw new Error('PAYPAL_WEBHOOK_CUSTOM_ID_MISSING');
    }
    await fulfillPaymentOrder(customId, {
      providerSubscriptionId: subscriptionId ?? customId,
      providerOrderId: subscriptionId ?? customId,
    });
    return { ok: true, action: 'subscription_activated' as const };
  }

  if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
    if (customId) {
      await cancelSubscriptionByPaymentOrderId(customId, eventType);
    }
    return { ok: true, action: 'subscription_cancelled' as const };
  }

  return { ok: true, action: 'ignored' as const };
}

export async function capturePaymentOrder(orderId: string) {
  const runtime = getPlatformRuntime();
  const order = await runtime.paymentOrders.getById(orderId);
  if (!order) {
    throw new Error('PAYMENT_ORDER_NOT_FOUND');
  }

  if (order.status === 'paid') {
    return order;
  }

  if (!order.providerOrderId) {
    throw new Error('PAYPAL_PROVIDER_ORDER_ID_MISSING');
  }

  const capture = await capturePayPalOrder(order.providerOrderId);
  const payerId = extractPayerId(capture);

  return fulfillPaymentOrder(order.id, {
    providerCustomerId: payerId ?? order.providerCustomerId ?? null,
    providerOrderId: order.providerOrderId,
  });
}

export async function findPaymentOrderByProviderOrderId(organizationId: string, providerOrderId: string) {
  const runtime = getPlatformRuntime();
  const orders = await runtime.paymentOrders.listByOrganizationId(organizationId);
  return orders.find((order) => order.providerOrderId === providerOrderId) ?? null;
}

async function createPayPalOrderWithPaymentOrder(input: {
  orderId: string;
  purchase: ReturnType<typeof buildCreditPackPurchase>;
  origin: string;
  locale: string;
}): Promise<PayPalApprovalResult> {
  const pack = getCreditPackCatalogEntry(input.purchase.creditPackKey as CreditPackKey);
  return createPayPalOrder({
    customId: input.orderId,
    amountCents: input.purchase.amountCents,
    description: `${pack.credits} credits`,
    returnUrl: buildBillingReturnUrl({
      origin: input.origin,
      locale: input.locale,
      purchaseKind: 'credit-pack',
      paymentOrderId: input.orderId,
    }),
    cancelUrl: buildPricingCancelUrl(input.origin, input.locale, 'credit-pack'),
    invoiceId: input.orderId,
  });
}

async function createPayPalSubscriptionWithPlan(input: {
  orderId: string;
  planKey: PlanKey;
  email: string;
  origin: string;
  locale: string;
}): Promise<PayPalApprovalResult> {
  const planId = resolvePayPalPlanId(input.planKey);
  return createPayPalSubscription({
    customId: input.orderId,
    planId,
    returnUrl: buildBillingReturnUrl({
      origin: input.origin,
      locale: input.locale,
      purchaseKind: 'subscription',
      paymentOrderId: input.orderId,
    }),
    cancelUrl: buildPricingCancelUrl(input.origin, input.locale, 'subscription'),
    subscriberEmail: input.email,
  });
}

function buildBillingReturnUrl(input: {
  origin: string;
  locale: string;
  purchaseKind: CheckoutPurchaseKind;
  paymentOrderId: string;
}) {
  const url = new URL(`${input.origin}${getLocalizedPath(input.locale, 'billing')}`);
  url.searchParams.set('checkout', 'success');
  url.searchParams.set('purchaseKind', input.purchaseKind);
  url.searchParams.set('paymentOrderId', input.paymentOrderId);
  return url.toString();
}

function buildPricingCancelUrl(origin: string, locale: string, purchaseKind: CheckoutPurchaseKind) {
  const url = new URL(`${origin}${getLocalizedPath(locale, 'pricing')}`);
  url.searchParams.set('checkout', 'cancelled');
  url.searchParams.set('purchaseKind', purchaseKind);
  return url.toString();
}

function getLocalizedPath(locale: string, route: 'billing' | 'pricing') {
  return `/${locale === 'en-US' ? 'en-US' : 'zh-CN'}/${route}`;
}

function resolvePayPalPlanId(planKey: PlanKey): string {
  const specificKey = `PAYPAL_PLAN_ID_${planKey.toUpperCase()}`;
  const specificPlanId = process.env[specificKey]?.trim();
  const fallbackPlanId = process.env.PAYPAL_PLAN_ID?.trim();
  const planId = specificPlanId || fallbackPlanId;

  if (!planId) {
    throw new Error(`PAYPAL_PLAN_ID_MISSING: ${planKey}`);
  }

  return planId;
}

async function cancelSubscriptionByPaymentOrderId(orderId: string, eventType: string) {
  const runtime = getPlatformRuntime();
  const order = await runtime.paymentOrders.getById(orderId);
  if (!order) {
    return;
  }

  const subscription = await runtime.subscriptions.getCurrentByOrganizationId(order.organizationId);
  if (!subscription) {
    return;
  }

  await runtime.subscriptions.update(subscription.id, {
    status: 'canceled',
    canceledAt: new Date().toISOString(),
    updatedByUserId: order.updatedByUserId ?? order.createdByUserId ?? null,
  });

  await runtime.paymentOrders.update(order.id, {
    metadata: {
      ...order.metadata,
      webhookEventType: eventType,
    },
    updatedByUserId: order.updatedByUserId ?? order.createdByUserId ?? null,
  });
}

function extractWebhookResource(event: Record<string, unknown>): Record<string, unknown> {
  const resource = event.resource;
  if (resource && typeof resource === 'object' && !Array.isArray(resource)) {
    return resource as Record<string, unknown>;
  }

  const data = event.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = (data as Record<string, unknown>).resource;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }

  return {};
}

function extractCustomId(resource: Record<string, unknown>): string | null {
  const candidate = resource.custom_id ?? resource.customId ?? resource.invoice_id;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }

  const purchaseUnits = resource.purchase_units;
  if (Array.isArray(purchaseUnits)) {
    for (const unit of purchaseUnits) {
      if (!unit || typeof unit !== 'object' || Array.isArray(unit)) {
        continue;
      }
      const purchaseCustomId = (unit as Record<string, unknown>).custom_id;
      if (typeof purchaseCustomId === 'string' && purchaseCustomId.trim()) {
        return purchaseCustomId.trim();
      }
      const purchaseInvoiceId = (unit as Record<string, unknown>).invoice_id;
      if (typeof purchaseInvoiceId === 'string' && purchaseInvoiceId.trim()) {
        return purchaseInvoiceId.trim();
      }
    }
  }

  return null;
}

function extractSubscriptionId(resource: Record<string, unknown>): string | null {
  const candidate = resource.id ?? resource.subscription_id ?? resource.billing_agreement_id;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function extractCaptureId(resource: Record<string, unknown>): string | null {
  const candidate = resource.id ?? resource.capture_id ?? resource.order_id;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }

  const relatedIds = resource.supplementary_data;
  if (relatedIds && typeof relatedIds === 'object' && !Array.isArray(relatedIds)) {
    const related = (relatedIds as Record<string, unknown>).related_ids;
    if (related && typeof related === 'object' && !Array.isArray(related)) {
      const orderId = (related as Record<string, unknown>).order_id;
      if (typeof orderId === 'string' && orderId.trim()) {
        return orderId.trim();
      }
    }
  }

  return null;
}

function extractPayerId(resource: Record<string, unknown>): string | null {
  const payer = resource.payer;
  if (payer && typeof payer === 'object' && !Array.isArray(payer)) {
    const id = (payer as Record<string, unknown>).payer_id;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
  }

  const subscriber = resource.subscriber;
  if (subscriber && typeof subscriber === 'object' && !Array.isArray(subscriber)) {
    const id = (subscriber as Record<string, unknown>).payer_id;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
  }

  return null;
}

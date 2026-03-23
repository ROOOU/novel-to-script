import type Stripe from 'stripe';
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
import { getStripeClient, isStripeEnabled } from '@/server/billing/stripe';
import { getPlatformRuntime } from '@/server/shared/platform';
import { readPlatformStore, updatePlatformStore } from '@/server/shared/platform/runtime';

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
  currency: 'CNY' | 'USD';
  purchaseKind: 'subscription' | 'credit-pack';
  planKey?: string;
  creditPackKey?: string;
}) {
  const runtime = getPlatformRuntime();
  const provider = input.currency === 'USD' && isStripeEnabled() ? 'stripe' : 'manual';

  if (input.purchaseKind === 'subscription') {
    const purchase = buildSubscriptionPurchase(input.planKey as PlanKey, input.currency, provider);
    const order = await runtime.paymentOrders.create({
      organizationId: input.organizationId,
      provider,
      purchaseKind: 'subscription',
      planKey: purchase.planKey,
      amountCents: purchase.amountCents,
      currency: purchase.currency,
      creditsGranted: purchase.creditsGranted,
      createdByUserId: input.userId,
      metadata: {
        locale: input.locale,
      },
    });

    if (provider === 'manual') {
      return {
        order,
        mode: 'manual' as const,
      };
    }

    const plan = getPlanCatalogEntry(input.planKey as PlanKey);
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: `${input.origin}/billing?checkout=success`,
      cancel_url: `${input.origin}/pricing?checkout=cancelled`,
      customer_email: input.email,
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: {
              name: plan.name[input.locale === 'en-US' ? 'en-US' : 'zh-CN'],
              description: plan.description[input.locale === 'en-US' ? 'en-US' : 'zh-CN'],
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: purchase.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderId: order.id,
        organizationId: input.organizationId,
        purchaseKind: 'subscription',
        planKey: input.planKey as string,
        creditsGranted: String(purchase.creditsGranted ?? 0),
      },
      subscription_data: {
        metadata: {
          orderId: order.id,
          organizationId: input.organizationId,
          planKey: input.planKey as string,
          creditsGranted: String(purchase.creditsGranted ?? 0),
        },
      },
    });

    const updatedOrder = await runtime.paymentOrders.update(order.id, {
      checkoutSessionId: session.id,
      updatedByUserId: input.userId,
    });

    return {
      order: updatedOrder,
      mode: 'stripe' as const,
      url: session.url,
    };
  }

  const purchase = buildCreditPackPurchase(input.creditPackKey as CreditPackKey, input.currency, provider);
  const order = await runtime.paymentOrders.create({
    organizationId: input.organizationId,
    provider,
    purchaseKind: 'credit-pack',
    creditPackKey: purchase.creditPackKey,
    amountCents: purchase.amountCents,
    currency: purchase.currency,
    creditsGranted: purchase.creditsGranted,
    createdByUserId: input.userId,
    metadata: {
      locale: input.locale,
    },
  });

  if (provider === 'manual') {
    return {
      order,
      mode: 'manual' as const,
    };
  }

  const pack = getCreditPackCatalogEntry(input.creditPackKey as CreditPackKey);
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${input.origin}/billing?checkout=success`,
    cancel_url: `${input.origin}/pricing?checkout=cancelled`,
    customer_email: input.email,
    line_items: [
      {
        price_data: {
          currency: input.currency.toLowerCase(),
          product_data: {
            name: `${pack.credits} credits`,
          },
          unit_amount: purchase.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId: order.id,
      organizationId: input.organizationId,
      purchaseKind: 'credit-pack',
      creditPackKey: input.creditPackKey as string,
      creditsGranted: String(pack.credits),
    },
  });

  const updatedOrder = await runtime.paymentOrders.update(order.id, {
    checkoutSessionId: session.id,
    updatedByUserId: input.userId,
  });

  return {
    order: updatedOrder,
    mode: 'stripe' as const,
    url: session.url,
  };
}

export async function createBillingPortalSession(input: {
  organizationId: string;
  origin: string;
}) {
  if (!isStripeEnabled()) {
    throw new Error('STRIPE_NOT_CONFIGURED');
  }

  const runtime = getPlatformRuntime();
  const subscription = await runtime.subscriptions.getCurrentByOrganizationId(input.organizationId);
  if (!subscription?.providerCustomerId) {
    throw new Error('STRIPE_CUSTOMER_NOT_FOUND');
  }

  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: subscription.providerCustomerId,
    return_url: `${input.origin}/billing`,
  });
}

export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfillStripeCheckoutSession(session);
      return;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await updateSubscriptionStatusByProviderId(getInvoiceSubscriptionId(invoice), 'active');
      return;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await updateSubscriptionStatusByProviderId(getInvoiceSubscriptionId(invoice), 'past_due');
      return;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await updateSubscriptionSnapshot(subscription);
      return;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await updateSubscriptionStatusByProviderId(subscription.id, 'canceled');
      return;
    }
    default:
      return;
  }
}

export async function fulfillPaymentOrder(orderId: string, overrides?: {
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
}) {
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
  });

  if (updatedOrder.purchaseKind === 'subscription' && updatedOrder.planKey) {
    const plan = getPlanCatalogEntry(updatedOrder.planKey as PlanKey);
    await runtime.subscriptions.upsertCurrent(updatedOrder.organizationId, {
      organizationId: updatedOrder.organizationId,
      provider: updatedOrder.provider,
      providerCustomerId: updatedOrder.providerCustomerId,
      providerSubscriptionId: updatedOrder.providerSubscriptionId,
      planKey: plan.key,
      status: 'active',
      billingInterval: plan.billingInterval,
      entitlements: getPlanEntitlements(plan.key),
      priceCents: plan.prices[updatedOrder.currency].amountCents,
      currency: updatedOrder.currency,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      portalManagementEnabled: updatedOrder.provider === 'stripe',
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

async function fulfillStripeCheckoutSession(session: Stripe.Checkout.Session) {
  const runtime = getPlatformRuntime();
  const order = await runtime.paymentOrders.getByCheckoutSessionId(session.id);
  if (!order) {
    return;
  }

  await fulfillPaymentOrder(order.id, {
    providerCustomerId:
      typeof session.customer === 'string' ? session.customer : order.providerCustomerId,
    providerSubscriptionId:
      typeof session.subscription === 'string'
        ? session.subscription
        : order.providerSubscriptionId,
  });
}

async function updateSubscriptionStatusByProviderId(
  providerSubscriptionId: string,
  status: 'active' | 'past_due' | 'canceled'
) {
  if (!providerSubscriptionId) {
    return;
  }

  await updatePlatformStore(async (store) => {
    const subscription = store.subscriptions.find((entry) => entry.providerSubscriptionId === providerSubscriptionId);
    if (!subscription) {
      return;
    }
    subscription.status = status;
    subscription.updatedAt = new Date().toISOString();
  });
}

async function updateSubscriptionSnapshot(subscription: Stripe.Subscription) {
  await updatePlatformStore(async (store) => {
    const current = store.subscriptions.find((entry) => entry.providerSubscriptionId === subscription.id);
    if (!current) {
      return;
    }
    current.status = mapStripeSubscriptionStatus(subscription.status);
    current.providerCustomerId =
      typeof subscription.customer === 'string' ? subscription.customer : current.providerCustomerId;
    current.currentPeriodStart = new Date(subscription.items.data[0]?.current_period_start * 1000).toISOString();
    current.currentPeriodEnd = new Date(subscription.items.data[0]?.current_period_end * 1000).toISOString();
    current.updatedAt = new Date().toISOString();
  });
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' {
  switch (status) {
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due';
    case 'trialing':
      return 'trialing';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'expired';
  }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string {
  const candidate =
    (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;

  if (typeof candidate === 'string') {
    return candidate;
  }

  if (candidate && typeof candidate === 'object' && 'id' in candidate) {
    return String(candidate.id);
  }

  return '';
}

export async function findPaymentOrderByProviderSubscriptionId(providerSubscriptionId: string) {
  const store = await readPlatformStore();
  return store.paymentOrders.find((order) => order.providerSubscriptionId === providerSubscriptionId) ?? null;
}

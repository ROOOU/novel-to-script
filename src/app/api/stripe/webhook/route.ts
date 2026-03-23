import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleStripeWebhook } from '@/server/billing/payments';
import { getStripeClient, isStripeEnabled } from '@/server/billing/stripe';

export async function POST(request: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const signature = (await headers()).get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  try {
    let event: Stripe.Event;
    if (signature && webhookSecret) {
      event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      event = JSON.parse(rawBody) as Stripe.Event;
    }

    await handleStripeWebhook(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'WEBHOOK_FAILED',
      },
      { status: 400 }
    );
  }
}

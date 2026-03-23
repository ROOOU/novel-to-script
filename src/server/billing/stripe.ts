import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient(): Stripe {
  if (!isStripeEnabled()) {
    throw new Error('STRIPE_NOT_CONFIGURED');
  }

  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
  return stripeClient;
}

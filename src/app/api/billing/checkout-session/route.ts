import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutOrder } from '@/server/billing/payments';
import { requireViewerResponse } from '@/server/auth/http';

const checkoutSchema = z.object({
  purchaseKind: z.enum(['subscription', 'credit-pack']),
  currency: z.enum(['CNY', 'USD']),
  planKey: z.string().optional(),
  creditPackKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const body = checkoutSchema.parse(await request.json());
  const headerStore = await headers();
  const origin =
    request.nextUrl.origin ||
    headerStore.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';

  const checkout = await createCheckoutOrder({
    organizationId: viewer.organization.id,
    userId: viewer.user.id,
    email: viewer.user.email,
    locale: viewer.session.locale,
    origin,
    currency: body.currency,
    purchaseKind: body.purchaseKind,
    planKey: body.planKey,
    creditPackKey: body.creditPackKey,
  });

  return NextResponse.json({
    ok: true,
    checkout,
  });
}

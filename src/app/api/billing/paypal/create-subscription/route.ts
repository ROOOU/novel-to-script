import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { PlanKey } from '@/server/billing/catalog';
import { createSubscriptionCheckout } from '@/server/billing/payments';
import { requireViewerResponse } from '@/server/auth/http';

const createSubscriptionSchema = z.object({
  planKey: z.string().min(1),
  requestedCurrency: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  try {
    const body = createSubscriptionSchema.parse(await request.json());
    const headerStore = await headers();
    const origin =
      request.nextUrl.origin ||
      headerStore.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    const checkout = await createSubscriptionCheckout({
      organizationId: viewer.organization.id,
      userId: viewer.user.id,
      email: viewer.user.email,
      locale: viewer.session.locale,
      origin,
      planKey: body.planKey as PlanKey,
      requestedCurrency: body.requestedCurrency,
    });

    return NextResponse.json({
      ok: true,
      checkout,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'PAYPAL_CREATE_SUBSCRIPTION_FAILED',
      },
      { status: 400 }
    );
  }
}

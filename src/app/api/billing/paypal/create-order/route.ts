import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { CreditPackKey } from '@/server/billing/catalog';
import { createCreditPackCheckout } from '@/server/billing/payments';
import { requireViewerResponse } from '@/server/auth/http';
import { getPayPalRouteErrorStatus, logPayPalRouteError } from '@/app/api/billing/paypal/error-response';

const createOrderSchema = z.object({
  creditPackKey: z.string().min(1),
  requestedCurrency: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  try {
    const body = createOrderSchema.parse(await request.json());
    const headerStore = await headers();
    const origin =
      request.nextUrl.origin ||
      headerStore.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    const checkout = await createCreditPackCheckout({
      organizationId: viewer.organization.id,
      userId: viewer.user.id,
      email: viewer.user.email,
      locale: viewer.session.locale,
      origin,
      creditPackKey: body.creditPackKey as CreditPackKey,
      requestedCurrency: body.requestedCurrency,
    });

    return NextResponse.json({
      ok: true,
      checkout,
      paymentOrderId: checkout.order.id,
      providerOrderId: checkout.providerOrderId,
    });
  } catch (error) {
    logPayPalRouteError('create-order', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'PAYPAL_CREATE_ORDER_FAILED',
      },
      { status: getPayPalRouteErrorStatus(error) }
    );
  }
}

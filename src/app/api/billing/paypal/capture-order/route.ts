import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { capturePaymentOrder, findPaymentOrderByProviderOrderId } from '@/server/billing/payments';
import { requireViewerResponse } from '@/server/auth/http';
import { getPayPalRouteErrorStatus, logPayPalRouteError } from '@/app/api/billing/paypal/error-response';

const captureOrderSchema = z.object({
  paymentOrderId: z.string().optional(),
  providerOrderId: z.string().optional(),
}).refine((value) => Boolean(value.paymentOrderId || value.providerOrderId), {
  message: 'paymentOrderId or providerOrderId is required',
});

export async function POST(request: NextRequest) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  try {
    const body = captureOrderSchema.parse(await request.json());
    if (body.paymentOrderId) {
      const order = await capturePaymentOrder(body.paymentOrderId);
      return NextResponse.json({
        ok: true,
        order,
      });
    }

    const paymentOrder = body.providerOrderId
      ? await findPaymentOrderByProviderOrderId(viewer.organization.id, body.providerOrderId)
      : null;

    if (!paymentOrder) {
      return NextResponse.json(
        {
          ok: false,
          error: 'PAYMENT_ORDER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const order = await capturePaymentOrder(paymentOrder.id);
    return NextResponse.json({
      ok: true,
      order,
    });
  } catch (error) {
    logPayPalRouteError('capture-order', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'PAYPAL_CAPTURE_FAILED',
      },
      { status: getPayPalRouteErrorStatus(error) }
    );
  }
}

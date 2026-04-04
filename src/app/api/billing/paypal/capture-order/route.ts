import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { capturePaymentOrder, findPaymentOrderByProviderOrderId } from '@/server/billing/payments';
import { requireViewerPlatformContext } from '@/server/auth/http';
import { applyPlatformResponseHeaders, getPlatformRuntime } from '@/server/shared/platform';

const captureOrderSchema = z.object({
  paymentOrderId: z.string().optional(),
  providerOrderId: z.string().optional(),
}).refine((value) => Boolean(value.paymentOrderId || value.providerOrderId), {
  message: 'paymentOrderId or providerOrderId is required',
});

export async function POST(request: NextRequest) {
  const { viewer, context, response } = await requireViewerPlatformContext(request);
  if (response || !viewer) {
    return response;
  }

  try {
    const body = captureOrderSchema.parse(await request.json());
    if (body.paymentOrderId) {
      const runtime = getPlatformRuntime();
      const paymentOrder = await runtime.paymentOrders.getById(body.paymentOrderId);
      if (!paymentOrder || paymentOrder.organizationId !== viewer.organization.id) {
        return applyPlatformResponseHeaders(
          NextResponse.json(
            {
              ok: false,
              error: 'PAYMENT_ORDER_NOT_FOUND',
            },
            { status: 404 }
          ),
          context
        );
      }

      const order = await capturePaymentOrder(body.paymentOrderId);
      return applyPlatformResponseHeaders(
        NextResponse.json({
          ok: true,
          order,
        }),
        context
      );
    }

    const paymentOrder = body.providerOrderId
      ? await findPaymentOrderByProviderOrderId(viewer.organization.id, body.providerOrderId)
      : null;

    if (!paymentOrder) {
      return applyPlatformResponseHeaders(
        NextResponse.json(
          {
            ok: false,
            error: 'PAYMENT_ORDER_NOT_FOUND',
          },
          { status: 404 }
        ),
        context
      );
    }

    const order = await capturePaymentOrder(paymentOrder.id);
    return applyPlatformResponseHeaders(
      NextResponse.json({
        ok: true,
        order,
      }),
      context
    );
  } catch (error) {
    return applyPlatformResponseHeaders(
      NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'PAYPAL_CAPTURE_FAILED',
        },
        { status: 400 }
      ),
      context
    );
  }
}

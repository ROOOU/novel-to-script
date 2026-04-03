import { NextRequest, NextResponse } from 'next/server';
import { requireViewerPlatformContext } from '@/server/auth/http';
import { fulfillPaymentOrder } from '@/server/billing/payments';
import { applyPlatformResponseHeaders, getPlatformRuntime } from '@/server/shared/platform';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { viewer, context, response } = await requireViewerPlatformContext(request);
  if (response || !viewer) {
    return response;
  }

  const { id } = await params;
  const runtime = getPlatformRuntime();
  const order = await runtime.paymentOrders.getById(id);
  if (!order || order.organizationId !== viewer.organization.id) {
    return applyPlatformResponseHeaders(
      NextResponse.json(
        {
          ok: false,
          error: 'ORDER_NOT_FOUND',
        },
        { status: 404 }
      ),
      context
    );
  }

  const fulfilled = await fulfillPaymentOrder(order.id);
  return applyPlatformResponseHeaders(
    NextResponse.json({
      ok: true,
      order: fulfilled,
    }),
    context
  );
}

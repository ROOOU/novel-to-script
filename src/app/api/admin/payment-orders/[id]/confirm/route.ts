import { NextResponse } from 'next/server';
import { requireViewerResponse } from '@/server/auth/http';
import { fulfillPaymentOrder } from '@/server/billing/payments';
import { getPlatformRuntime } from '@/server/shared/platform';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { id } = await params;
  const runtime = getPlatformRuntime();
  const order = await runtime.paymentOrders.getById(id);
  if (!order || order.organizationId !== viewer.organization.id) {
    return NextResponse.json(
      {
        ok: false,
        error: 'ORDER_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  const fulfilled = await fulfillPaymentOrder(order.id);
  return NextResponse.json({
    ok: true,
    order: fulfilled,
  });
}

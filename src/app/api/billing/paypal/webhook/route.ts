import { NextRequest, NextResponse } from 'next/server';
import { handlePayPalWebhook } from '@/server/billing/payments';
import {
  resolvePayPalWebhookHeaders,
  verifyPayPalWebhookSignature,
} from '@/server/billing/paypal';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody) as Record<string, unknown>;
    const headers = resolvePayPalWebhookHeaders(request.headers);

    if (!headers.transmissionId || !headers.transmissionTime || !headers.transmissionSig || !headers.certUrl || !headers.authAlgo) {
      return NextResponse.json(
        {
          ok: false,
          error: 'PAYPAL_WEBHOOK_HEADERS_MISSING',
        },
        { status: 400 }
      );
    }

    const verified = await verifyPayPalWebhookSignature({
      event,
      transmissionId: headers.transmissionId,
      transmissionTime: headers.transmissionTime,
      transmissionSig: headers.transmissionSig,
      certUrl: headers.certUrl,
      authAlgo: headers.authAlgo,
    });

    if (!verified) {
      return NextResponse.json(
        {
          ok: false,
          error: 'PAYPAL_WEBHOOK_SIGNATURE_INVALID',
        },
        { status: 400 }
      );
    }

    const result = await handlePayPalWebhook(event);
    return NextResponse.json({
      ok: true,
      received: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'PAYPAL_WEBHOOK_FAILED',
      },
      { status: 500 }
    );
  }
}

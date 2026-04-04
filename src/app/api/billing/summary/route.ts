import { NextRequest, NextResponse } from 'next/server';
import { requireViewerPlatformContext } from '@/server/auth/http';
import { applyPlatformResponseHeaders } from '@/server/shared/platform';
import { getBillingSummary } from '@/server/billing/payments';

export async function GET(request: NextRequest) {
  const { viewer, context, response } = await requireViewerPlatformContext(request);
  if (response || !viewer) {
    return response;
  }

  const summary = await getBillingSummary(viewer.organization.id);
  return applyPlatformResponseHeaders(
    NextResponse.json({
      ok: true,
      ...summary,
    }),
    context
  );
}

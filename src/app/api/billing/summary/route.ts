import { NextResponse } from 'next/server';
import { requireViewerResponse } from '@/server/auth/http';
import { getBillingSummary } from '@/server/billing/payments';

export async function GET() {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const summary = await getBillingSummary(viewer.organization.id);
  return NextResponse.json({
    ok: true,
    ...summary,
  });
}

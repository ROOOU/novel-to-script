import { NextResponse } from 'next/server';
import { requireViewerResponse } from '@/server/auth/http';
import { getBillingUsageSummary } from '@/server/billing/usage';

export async function GET() {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const usage = await getBillingUsageSummary(viewer.organization.id);
  return NextResponse.json({
    ok: true,
    usage,
  });
}

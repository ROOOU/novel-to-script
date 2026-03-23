import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createBillingPortalSession } from '@/server/billing/payments';
import { requireViewerResponse } from '@/server/auth/http';

export async function POST() {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  try {
    const headerStore = await headers();
    const origin =
      headerStore.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const session = await createBillingPortalSession({
      organizationId: viewer.organization.id,
      origin,
    });
    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'PORTAL_FAILED',
      },
      { status: 400 }
    );
  }
}

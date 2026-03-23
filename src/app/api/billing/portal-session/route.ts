import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'BILLING_PORTAL_NOT_SUPPORTED',
    },
    { status: 410 }
  );
}

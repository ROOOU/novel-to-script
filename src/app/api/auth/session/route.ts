import { NextResponse } from 'next/server';
import { requireViewerResponse } from '@/server/auth/http';

export async function GET() {
  const { viewer, response } = await requireViewerResponse();
  if (!viewer || response) {
    return response;
  }

  return NextResponse.json({
    ok: true,
    viewer: {
      user: viewer.user,
      organization: viewer.organization,
      workspace: viewer.workspace,
      subscription: viewer.subscription,
      creditAccount: viewer.creditAccount,
    },
  });
}

export async function DELETE() {
  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      message:
        'Session sign-out accepted. Client-side Clerk sign-out and redirect should complete the logout flow.',
    },
    { status: 202 }
  );
}

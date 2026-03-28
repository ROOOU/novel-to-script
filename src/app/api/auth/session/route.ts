import { NextResponse } from 'next/server';
import { getCurrentViewer } from '@/server/auth/service';

export async function GET() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json(
      {
        ok: false,
        error: 'UNAUTHORIZED',
      },
      { status: 401 }
    );
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

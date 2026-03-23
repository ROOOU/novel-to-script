import { NextResponse } from 'next/server';
import { getCurrentViewer } from './service';

export async function requireViewerResponse() {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return {
      viewer: null,
      response: NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    };
  }

  return {
    viewer,
    response: null,
  };
}

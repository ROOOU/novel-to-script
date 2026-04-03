import { NextRequest, NextResponse } from 'next/server';
import { getProjectBundle } from '@/server/projects/service';
import { applyPlatformResponseHeaders } from '@/server/shared/platform';
import { requireViewerPlatformContext } from '@/server/auth/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { viewer, response, context } = await requireViewerPlatformContext(request);
  if (response || !viewer || !context) {
    return response ?? undefined;
  }

  const { projectId } = await params;
  const bundle = await getProjectBundle(projectId);
  if (!bundle || bundle.project.organizationId !== viewer.organization.id) {
    return applyPlatformResponseHeaders(NextResponse.json(
      {
        ok: false,
        error: 'PROJECT_NOT_FOUND',
      },
      { status: 404 }
    ), context);
  }

  return applyPlatformResponseHeaders(NextResponse.json({
    ok: true,
    ...bundle,
  }), context);
}

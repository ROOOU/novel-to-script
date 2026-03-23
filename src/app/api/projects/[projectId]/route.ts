import { NextResponse } from 'next/server';
import { getProjectBundle } from '@/server/projects/service';
import { requireViewerResponse } from '@/server/auth/http';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { projectId } = await params;
  const bundle = await getProjectBundle(projectId);
  if (!bundle || bundle.project.organizationId !== viewer.organization.id) {
    return NextResponse.json(
      {
        ok: false,
        error: 'PROJECT_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    ...bundle,
  });
}

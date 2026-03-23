import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireViewerResponse } from '@/server/auth/http';
import { createProjectExportArtifact } from '@/server/projects/export-service';
import { getPlatformRuntime } from '@/server/shared/platform';

const createExportSchema = z.object({
  format: z.enum(['markdown', 'json', 'text']).default('markdown'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { projectId } = await params;
  const runtime = getPlatformRuntime();
  const project = await runtime.projects.getById(projectId);
  if (!project || project.organizationId !== viewer.organization.id) {
    return NextResponse.json(
      {
        ok: false,
        error: 'PROJECT_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  const body = createExportSchema.parse(await request.json());
  const artifact = await createProjectExportArtifact({
    projectId,
    organizationId: viewer.organization.id,
    workspaceId: project.workspaceId,
    userId: viewer.user.id,
    format: body.format,
  });

  return NextResponse.json({
    ok: true,
    artifact,
    downloadUrl: `/api/artifacts/${artifact.id}/download`,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireViewerPlatformContext } from '@/server/auth/http';
import { createProjectExportArtifact } from '@/server/projects/export-service';
import {
  applyPlatformResponseHeaders,
  getPlatformRuntime,
} from '@/server/shared/platform';

const createExportSchema = z.object({
  format: z.enum(['markdown', 'json', 'text']).default('markdown'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { viewer, context, response } = await requireViewerPlatformContext(request);
  if (response || !viewer) {
    return response;
  }

  const { projectId } = await params;
  const runtime = getPlatformRuntime();
  const project = await runtime.projects.getById(projectId);
  if (!project || project.organizationId !== viewer.organization.id) {
    return applyPlatformResponseHeaders(
      NextResponse.json(
        {
          ok: false,
          error: 'PROJECT_NOT_FOUND',
        },
        { status: 404 }
      ),
      context
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

  return applyPlatformResponseHeaders(
    NextResponse.json({
      ok: true,
      artifact,
      downloadUrl: `/api/artifacts/${artifact.id}/download`,
    }),
    context
  );
}

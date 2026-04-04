import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveProjectSource } from '@/server/projects/service';
import { requireViewerPlatformContext } from '@/server/auth/http';
import {
  applyPlatformResponseHeaders,
  getPlatformRuntime,
} from '@/server/shared/platform';

const sourceSchema = z.object({
  title: z.string().min(1),
  textContent: z.string().min(1),
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

  const body = sourceSchema.parse(await request.json());
  const sourceDocument = await saveProjectSource({
    projectId,
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    userId: viewer.user.id,
    title: body.title,
    textContent: body.textContent,
  });

  return applyPlatformResponseHeaders(
    NextResponse.json({
      ok: true,
      sourceDocument,
    }),
    context
  );
}

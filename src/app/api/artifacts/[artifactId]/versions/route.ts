import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireViewerPlatformContext } from '@/server/auth/http';
import { applyPlatformResponseHeaders, getPlatformRuntime } from '@/server/shared/platform';

const createVersionSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  const { viewer, context, response } = await requireViewerPlatformContext(request);
  if (response || !viewer) {
    return response;
  }

  const { artifactId } = await params;
  const runtime = getPlatformRuntime();
  const artifact = await runtime.generationArtifacts.getById(artifactId);
  if (!artifact || artifact.organizationId !== viewer.organization.id) {
    return applyPlatformResponseHeaders(
      NextResponse.json(
        {
          ok: false,
          error: 'ARTIFACT_NOT_FOUND',
        },
        { status: 404 }
      ),
      context
    );
  }

  const body = createVersionSchema.parse(await request.json());
  const version = await runtime.generationArtifacts.create({
    organizationId: artifact.organizationId,
    workspaceId: artifact.workspaceId,
    projectId: artifact.projectId,
    generationJobId: artifact.generationJobId,
    sourceDocumentId: artifact.sourceDocumentId,
    kind: artifact.kind,
    format: artifact.format,
    title: body.title || artifact.title,
    content: body.content,
    isEditable: true,
    parentArtifactId: artifact.id,
    versionGroupId: artifact.versionGroupId ?? artifact.id,
    metadata: {
      ...artifact.metadata,
      editedByUserId: viewer.user.id,
      editedAt: new Date().toISOString(),
    },
    createdByUserId: viewer.user.id,
  });

  return applyPlatformResponseHeaders(
    NextResponse.json({
      ok: true,
      version,
    }),
    context
  );
}

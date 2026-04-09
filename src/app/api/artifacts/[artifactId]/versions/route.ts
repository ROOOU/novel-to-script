import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireViewerResponse } from '@/server/auth/http';
import { viewerOwnsArtifact } from '@/server/auth/viewer-access';
import { getPlatformRuntime } from '@/server/shared/platform';

const createVersionSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { artifactId } = await params;
  const runtime = getPlatformRuntime();
  const artifact = await runtime.generationArtifacts.getById(artifactId);
  if (!artifact || !viewerOwnsArtifact(viewer, artifact)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'ARTIFACT_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  let body: z.infer<typeof createVersionSchema>;
  try {
    body = createVersionSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? 'INVALID_VERSION_PAYLOAD'
        : 'INVALID_VERSION_PAYLOAD';
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    );
  }

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

  return NextResponse.json({
    ok: true,
    version,
  });
}

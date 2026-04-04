import { NextRequest, NextResponse } from 'next/server';
import { requireViewerPlatformContext } from '@/server/auth/http';
import { applyPlatformResponseHeaders, getPlatformRuntime } from '@/server/shared/platform';
import type { GenerationArtifactFormat } from '@/server/shared/platform/domain';

export async function GET(
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

  const filename = resolveArtifactFilename(artifact.title, artifact.format, artifact.metadata?.downloadFilename);

  return applyPlatformResponseHeaders(
    new NextResponse(artifact.content ?? '', {
      headers: {
        'Content-Type': `${artifact.format}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    }),
    context
  );
}

function resolveArtifactFilename(
  title: string,
  format: GenerationArtifactFormat,
  preferredFilename?: unknown
) {
  if (typeof preferredFilename === 'string' && preferredFilename.trim()) {
    return preferredFilename;
  }

  const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'artifact';
  return `${sanitizedTitle}.${extensionForFormat(format)}`;
}

function extensionForFormat(format: GenerationArtifactFormat) {
  switch (format) {
    case 'application/json':
      return 'json';
    case 'text/markdown':
      return 'md';
    case 'application/pdf':
      return 'pdf';
    case 'application/zip':
      return 'zip';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'text/plain':
    default:
      return 'txt';
  }
}

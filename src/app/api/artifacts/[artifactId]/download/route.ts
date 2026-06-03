import { NextResponse } from 'next/server';
import { requireViewerResponse } from '@/server/auth/http';
import { viewerOwnsArtifact } from '@/server/auth/viewer-access';
import { readStoredMedia } from '@/server/media/store';
import { getPlatformRuntime } from '@/server/shared/platform';
import type { GenerationArtifactFormat } from '@/server/shared/platform/domain';

export async function GET(
  _request: Request,
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

  const filename = resolveArtifactFilename(artifact.title, artifact.format, artifact.metadata?.downloadFilename);
  const body =
    artifact.storageKey
      ? (await readStoredMedia(artifact.storageKey)).buffer
      : resolveArtifactDownloadBody(artifact.content ?? '', artifact.metadata?.contentEncoding);
  const contentType = resolveContentTypeHeader(artifact.format);

  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
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
    case 'text/csv':
      return 'csv';
    case 'text/markdown':
      return 'md';
    case 'application/pdf':
      return 'pdf';
    case 'application/zip':
      return 'zip';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'text/plain':
    default:
      return 'txt';
  }
}

function resolveArtifactDownloadBody(content: string, contentEncoding: unknown) {
  if (contentEncoding === 'base64') {
    return Buffer.from(content, 'base64');
  }

  return content;
}

function resolveContentTypeHeader(format: GenerationArtifactFormat) {
  if (
    format === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    format === 'application/pdf' ||
    format === 'application/zip' ||
    format.startsWith('image/') ||
    format.startsWith('video/')
  ) {
    return format;
  }

  return `${format}; charset=utf-8`;
}

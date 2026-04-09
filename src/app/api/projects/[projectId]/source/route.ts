import { NextRequest, NextResponse } from 'next/server';
import { getTextFileBaseName, isSupportedTextFile, readTextFile } from '@/lib/file-text';
import { saveProjectSource } from '@/server/projects/service';
import { requireViewerResponse } from '@/server/auth/http';
import { viewerOwnsProject } from '@/server/auth/viewer-access';
import { getPlatformRuntime } from '@/server/shared/platform';

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
  if (!project || !viewerOwnsProject(viewer, project)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'PROJECT_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  let body: { title: string; textContent: string };
  try {
    body = await parseSourceRequest(request);
  } catch (error) {
    const message = error instanceof SourcePayloadError ? error.message : 'INVALID_SOURCE_PAYLOAD';
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    );
  }

  const sourceDocument = await saveProjectSource({
    projectId,
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    userId: viewer.user.id,
    title: body.title,
    textContent: body.textContent,
  });

  return NextResponse.json({
    ok: true,
    sourceDocument,
  });
}

class SourcePayloadError extends Error {}

async function parseSourceRequest(request: NextRequest): Promise<{ title: string; textContent: string }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return parseMultipartSourceRequest(request);
  }

  return parseJsonSourceRequest(request);
}

async function parseJsonSourceRequest(request: NextRequest): Promise<{ title: string; textContent: string }> {
  const payload = await request.json();
  return normalizeSourcePayload({
    title: payload?.title,
    textContent: payload?.textContent,
  });
}

async function parseMultipartSourceRequest(request: NextRequest): Promise<{ title: string; textContent: string }> {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    throw new SourcePayloadError('SOURCE_FILE_REQUIRED');
  }

  if (!isSupportedTextFile(file)) {
    throw new SourcePayloadError('UNSUPPORTED_SOURCE_FILE');
  }

  const rawTitle = formData.get('title');
  const title = typeof rawTitle === 'string' && rawTitle.trim()
    ? rawTitle
    : getTextFileBaseName(file.name);

  let textContent: string;
  try {
    textContent = await readTextFile(file);
  } catch {
    throw new SourcePayloadError('SOURCE_FILE_READ_FAILED');
  }

  return normalizeSourcePayload({ title, textContent });
}

function normalizeSourcePayload(payload: {
  title: unknown;
  textContent: unknown;
}): { title: string; textContent: string } {
  if (typeof payload.title !== 'string' || !payload.title.trim()) {
    throw new SourcePayloadError('TITLE_REQUIRED');
  }

  if (typeof payload.textContent !== 'string' || !payload.textContent.trim()) {
    throw new SourcePayloadError('TEXT_CONTENT_REQUIRED');
  }

  return {
    title: payload.title.trim(),
    textContent: payload.textContent.replace(/\r\n?/g, '\n'),
  };
}

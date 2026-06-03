import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { requireViewerResponse } from '@/server/auth/http';
import { viewerOwnsProject } from '@/server/auth/viewer-access';
import { storeBrowserFile } from '@/server/media/store';
import { getPlatformRuntime } from '@/server/shared/platform';

const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

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

  let uploadJobId: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new Error('ASSET_FILE_REQUIRED');
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) {
      throw new Error('ASSET_FILE_TYPE_INVALID');
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error('ASSET_FILE_TOO_LARGE');
    }

    const titleValue = formData.get('title');
    const title =
      typeof titleValue === 'string' && titleValue.trim()
        ? titleValue.trim()
        : getFileBaseName(file.name);

    const job = await runtime.generationJobs.create({
      organizationId: viewer.organization.id,
      workspaceId: viewer.workspace.id,
      projectId,
      kind: 'asset-upload',
      requestedByUserId: viewer.user.id,
      inputSnapshot: {
        originalFilename: file.name,
        mimeType: file.type,
        size: file.size,
      },
      billingState: 'none',
    });
    uploadJobId = job.id;

    await runtime.projects.update(projectId, {
      latestGenerationJobId: job.id,
      updatedByUserId: viewer.user.id,
    });
    await runtime.generationJobs.markRunning(job.id, undefined, viewer.user.id);

    const storedFile = await storeBrowserFile(file, {
      prefix: 'images',
      extension: extensionForMimeType(file.type) ?? path.extname(file.name),
    });

    const artifact = await runtime.generationArtifacts.create({
      organizationId: viewer.organization.id,
      workspaceId: viewer.workspace.id,
      projectId,
      generationJobId: job.id,
      kind: 'reference_image',
      format: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
      title,
      content: storedFile.content,
      storageKey: storedFile.storageKey,
      checksum: storedFile.checksum,
      metadata: {
        originalFilename: file.name,
        byteSize: file.size,
        downloadFilename: file.name,
        uploadKind: 'reference_image',
        ...(storedFile.contentEncoding ? { contentEncoding: storedFile.contentEncoding } : {}),
      },
      createdByUserId: viewer.user.id,
    });

    const succeededJob = await runtime.generationJobs.markSucceeded(job.id, {
      progress: 100,
      currentStep: 'done',
      outputSummary: 'Asset uploaded',
      settledCredits: 0,
      billingState: 'none',
      updatedByUserId: viewer.user.id,
    });

    return NextResponse.json({
      ok: true,
      job: succeededJob,
      artifact,
    });
  } catch (error) {
    if (uploadJobId) {
      await runtime.generationJobs.markFailed(uploadJobId, {
        errorMessage: error instanceof Error ? error.message : 'ASSET_UPLOAD_FAILED',
        billingState: 'none',
        updatedByUserId: viewer.user.id,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'ASSET_UPLOAD_FAILED',
      },
      { status: 400 }
    );
  }
}

function getFileBaseName(filename: string) {
  const baseName = path.basename(filename, path.extname(filename)).trim();
  return baseName || 'reference-image';
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireViewerResponse } from '@/server/auth/http';
import { cancelProjectGenerationJob, retryProjectGenerationJob } from '@/server/projects/job-actions';
import { getPlatformRuntime } from '@/server/shared/platform';

const jobActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('retry'),
  }),
  z.object({
    action: z.literal('cancel'),
  }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; jobId: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { projectId, jobId } = await params;
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

  try {
    const body = jobActionSchema.parse(await request.json());
    const result =
      body.action === 'retry'
        ? await retryProjectGenerationJob({
            organizationId: viewer.organization.id,
            workspaceId: viewer.workspace.id,
            projectId,
            userId: viewer.user.id,
            jobId,
          })
        : await cancelProjectGenerationJob({
            organizationId: viewer.organization.id,
            workspaceId: viewer.workspace.id,
            projectId,
            userId: viewer.user.id,
            jobId,
          });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PROJECT_JOB_ACTION_FAILED';
    const status =
      message === 'PROJECT_JOB_NOT_FOUND'
        ? 404
        : message === 'JOB_RETRY_NOT_ALLOWED' || message === 'JOB_CANCEL_NOT_ALLOWED'
          ? 409
          : 400;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}

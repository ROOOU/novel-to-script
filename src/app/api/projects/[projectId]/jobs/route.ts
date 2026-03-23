import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createProjectGenerationJob } from '@/server/generation/service';
import { requireViewerResponse } from '@/server/auth/http';
import { getPlatformRuntime } from '@/server/shared/platform';

const createJobSchema = z.object({
  kind: z.enum(['script-generation', 'storyboard-generation']),
  payload: z.record(z.string(), z.unknown()),
});

export async function GET(
  _request: NextRequest,
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

  const jobs = await runtime.generationJobs.listByProjectId(projectId);
  return NextResponse.json({
    ok: true,
    jobs: jobs.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  });
}

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

  try {
    const body = createJobSchema.parse(await request.json());
    const job = await createProjectGenerationJob({
      organizationId: viewer.organization.id,
      workspaceId: viewer.workspace.id,
      projectId,
      userId: viewer.user.id,
      kind: body.kind,
      body: body.payload as never,
    });
    return NextResponse.json({
      ok: true,
      job,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JOB_CREATE_FAILED';
    const status = message === 'INSUFFICIENT_CREDITS' ? 402 : 400;
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}

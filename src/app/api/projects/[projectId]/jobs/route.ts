import { NextRequest, NextResponse } from 'next/server';
import { createProjectGenerationJob } from '@/server/generation/service';
import { requireViewerResponse } from '@/server/auth/http';
import { getPlatformRuntime } from '@/server/shared/platform';
import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequestV2 } from '@/features/storyboard/contracts';
import { createJobSchema } from './schema';

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
    const normalizedPayload =
      body.kind === 'storyboard-generation'
        ? await normalizeStoryboardPayload({
            organizationId: viewer.organization.id,
            projectId,
            payload: body.payload,
          })
        : body.payload;
    const job = await createProjectGenerationJob({
      organizationId: viewer.organization.id,
      workspaceId: viewer.workspace.id,
      projectId,
      userId: viewer.user.id,
      kind: body.kind,
      body: normalizedPayload as ScriptGenerationRequest | StoryboardGenerateRequestV2,
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

async function normalizeStoryboardPayload(input: {
  organizationId: string;
  projectId: string;
  payload: StoryboardGenerateRequestV2;
}) {
  const runtime = getPlatformRuntime();
  const scriptArtifactIds = Array.from(
    new Set((input.payload.scriptArtifactIds ?? []).map((artifactId) => artifactId.trim()).filter(Boolean))
  );
  const scriptText = input.payload.scriptText?.trim();

  if (scriptArtifactIds.length > 0) {
    const artifacts = await Promise.all(
      scriptArtifactIds.map(async (artifactId) => ({
        artifactId,
        artifact: await runtime.generationArtifacts.getById(artifactId),
      }))
    );

    for (const { artifactId, artifact } of artifacts) {
      if (!artifact) {
        throw new Error(`SCRIPT_ARTIFACT_NOT_FOUND:${artifactId}`);
      }

      if (artifact.organizationId !== input.organizationId || artifact.projectId !== input.projectId) {
        throw new Error(`SCRIPT_ARTIFACT_NOT_IN_PROJECT:${artifactId}`);
      }

      if (artifact.kind !== 'script') {
        throw new Error(`SCRIPT_ARTIFACT_KIND_INVALID:${artifactId}`);
      }
    }
  }

  if (scriptArtifactIds.length === 0 && !scriptText) {
    throw new Error('STORYBOARD_SOURCE_REQUIRED');
  }

  return {
    ...input.payload,
    ...(scriptArtifactIds.length > 0 ? { scriptArtifactIds } : {}),
    ...(scriptText ? { scriptText } : {}),
  } satisfies StoryboardGenerateRequestV2;
}

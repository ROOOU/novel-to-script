import { NextRequest, NextResponse } from 'next/server';
import { viewerOwnsProject } from '@/server/auth/viewer-access';
import { createProjectGenerationJob } from '@/server/generation/service';
import { requireViewerResponse } from '@/server/auth/http';
import { getPlatformRuntime } from '@/server/shared/platform';
import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequestV2 } from '@/features/storyboard/contracts';
import { createJobSchema } from './schema';

export const maxDuration = 300;

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
  if (!project || !viewerOwnsProject(viewer, project)) {
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
  if (!project || !viewerOwnsProject(viewer, project)) {
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
  const scope = input.payload.scope === 'selection' ? 'selection' : 'all';
  const scriptArtifactIds = normalizeArtifactIds(input.payload.scriptArtifactIds);
  const selection = normalizeStoryboardSelection(input.payload.selection);
  const scriptText = input.payload.scriptText?.trim();
  const artifactIdsToValidate = Array.from(
    new Set([
      ...scriptArtifactIds,
      ...(scope === 'selection' ? selection.artifactIds : []),
    ])
  );
  const hasArtifactSource =
    scriptArtifactIds.length > 0 ||
    (scope === 'selection' && selection.artifactIds.length > 0);

  if (artifactIdsToValidate.length > 0) {
    const artifacts = await Promise.all(
      artifactIdsToValidate.map(async (artifactId) => ({
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

  if (scope === 'selection' && !hasStoryboardSelectionCriteria(selection)) {
    throw new Error('STORYBOARD_SELECTION_REQUIRED');
  }

  if (scope === 'selection' && !hasArtifactSource) {
    throw new Error('STORYBOARD_SELECTION_REQUIRES_SCRIPT_ARTIFACTS');
  }

  if (!hasArtifactSource && !scriptText) {
    throw new Error('STORYBOARD_SOURCE_REQUIRED');
  }

  return {
    ...input.payload,
    scope,
    ...(scriptArtifactIds.length > 0 ? { scriptArtifactIds } : {}),
    ...(scope === 'selection' ? { selection } : {}),
    ...(scriptText ? { scriptText } : {}),
  } satisfies StoryboardGenerateRequestV2;
}

function normalizeArtifactIds(ids: string[] | null | undefined): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  return Array.from(
    new Set(ids.map((artifactId) => artifactId.trim()).filter(Boolean))
  );
}

function normalizeStoryboardSelection(
  selection: StoryboardGenerateRequestV2['selection'] | null | undefined
) {
  return {
    artifactIds: normalizeArtifactIds(selection?.artifactIds),
    episodeNumbers: Array.isArray(selection?.episodeNumbers)
      ? Array.from(
          new Set(
            selection.episodeNumbers.filter(
              (episodeNumber): episodeNumber is number =>
                Number.isInteger(episodeNumber) && episodeNumber > 0
            )
          )
        )
      : [],
    sceneIds: Array.isArray(selection?.sceneIds)
      ? Array.from(
          new Set(
            selection.sceneIds
              .map((sceneId) => sceneId.trim())
              .filter(Boolean)
          )
        )
      : [],
  };
}

function hasStoryboardSelectionCriteria(selection: ReturnType<typeof normalizeStoryboardSelection>) {
  return (
    selection.artifactIds.length > 0 ||
    selection.episodeNumbers.length > 0 ||
    selection.sceneIds.length > 0
  );
}

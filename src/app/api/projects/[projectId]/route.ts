import { after, NextResponse } from 'next/server';
import { resolveStaleGenerationRecoveryWindowMs } from '@/lib/llm-config';
import { viewerOwnsProject } from '@/server/auth/viewer-access';
import { archiveProject, getProjectBundle } from '@/server/projects/service';
import { requireViewerResponse } from '@/server/auth/http';
import { processPersistedGenerationJob } from '@/server/generation/service';
import { getPlatformRuntime } from '@/server/shared/platform';
import type { GenerationArtifact, GenerationJob } from '@/server/shared/platform/domain';

export const maxDuration = 300;

const STALE_GENERATION_JOB_MS = resolveStaleGenerationRecoveryWindowMs(
  process.env.NOVELSCRIPT_STALE_GENERATION_JOB_MS
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { projectId } = await params;
  const bundle = await getProjectBundle(projectId);
  if (!bundle || !viewerOwnsProject(viewer, bundle.project)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'PROJECT_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  const staleJob = findRecoverableStaleJob(bundle.jobs, bundle.artifacts);
  if (staleJob) {
    after(async () => {
      try {
        const runtime = getPlatformRuntime();
        await runtime.generationJobs.update(staleJob.id, {
          currentStep: 'recovering',
          outputSummary: 'Resuming stalled generation',
          updatedByUserId: staleJob.requestedByUserId,
        });
        await processPersistedGenerationJob(staleJob.id);
      } catch (error) {
        console.error('[api/projects/:projectId] stale job recovery failed', {
          projectId,
          jobId: staleJob.id,
          error,
        });
      }
    });
  }

  return NextResponse.json({
    ok: true,
    ...bundle,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { projectId } = await params;

  try {
    const project = await archiveProject({
      projectId,
      organizationId: viewer.organization.id,
      workspaceId: viewer.workspace.id,
      userId: viewer.user.id,
    });

    return NextResponse.json({
      ok: true,
      project,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PROJECT_DELETE_FAILED';
    const status = message === 'PROJECT_NOT_FOUND' ? 404 : 400;
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}

function findRecoverableStaleJob(
  jobs: GenerationJob[],
  artifacts: GenerationArtifact[]
) {
  const now = Date.now();

  return jobs
    .filter((job) => job.status === 'queued' || job.status === 'running')
    .filter((job) => now - new Date(job.updatedAt).getTime() > STALE_GENERATION_JOB_MS)
    .filter((job) => !artifacts.some((artifact) => artifact.generationJobId === job.id))
    .filter((job) => isRecoverableEarlyStep(job))
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))[0] ?? null;
}

function isRecoverableEarlyStep(job: GenerationJob) {
  if (job.kind === 'video-generation') {
    return ['queued'].includes(job.currentStep ?? 'queued');
  }

  if (job.kind === 'asset-upload') {
    return false;
  }

  if (job.kind === 'storyboard-generation') {
    return ['queued', 'running'].includes(job.status);
  }

  return [
    'preprocessing',
    'analyzing',
    'recovering',
    'queued',
  ].includes(job.currentStep ?? 'queued');
}

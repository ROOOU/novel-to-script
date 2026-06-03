import type { GenerationJob } from '@/server/shared/platform/domain';
import { releaseJobCredits } from '@/server/billing/service';
import { createProjectGenerationJob } from '@/server/generation/service';
import { getPlatformRuntime } from '@/server/shared/platform';
import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequestV2 } from '@/features/storyboard/contracts';
import type { VideoGenerationRequest } from '@/features/video-generation/contracts';

export type ProjectGenerationJobActionResult =
  | {
      action: 'retry';
      originalJob: GenerationJob;
      job: GenerationJob;
    }
  | {
      action: 'cancel';
      job: GenerationJob;
    };

export async function retryProjectGenerationJob(input: {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  jobId: string;
}): Promise<ProjectGenerationJobActionResult> {
  const runtime = getPlatformRuntime();
  const job = await getProjectGenerationJobOrThrow(runtime, input);

  if (!isRetryableJob(job)) {
    throw new Error('JOB_RETRY_NOT_ALLOWED');
  }

  const snapshot = parseJobSnapshot(job.inputSnapshot);
  if (!snapshot.payload) {
    throw new Error('JOB_PAYLOAD_MISSING');
  }

  const retryJob = await createProjectGenerationJob({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    userId: input.userId,
    kind: job.kind,
    body: snapshot.payload,
    metadata: {
      ...snapshot.metadata,
      retriedFromJobId: job.id,
      retriedFromJobKind: job.kind,
      retriedFromJobStatus: job.status,
    },
  });

  return {
    action: 'retry',
    originalJob: job,
    job: retryJob,
  };
}

export async function cancelProjectGenerationJob(input: {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  jobId: string;
}): Promise<ProjectGenerationJobActionResult> {
  const runtime = getPlatformRuntime();
  const job = await getProjectGenerationJobOrThrow(runtime, input);

  if (job.status === 'cancelled' && job.billingState === 'released') {
    return {
      action: 'cancel',
      job,
    };
  }

  if (!isCancelableJob(job) && job.status !== 'cancelled') {
    throw new Error('JOB_CANCEL_NOT_ALLOWED');
  }

  const cancelledAt = new Date().toISOString();
  const cancelledJob = await runtime.generationJobs.cancel(job.id, cancelledAt, input.userId);

  if ((job.reservedCredits ?? 0) > 0 && job.billingState !== 'released') {
    await releaseJobCredits({
      organizationId: input.organizationId,
      userId: input.userId,
      generationJobId: job.id,
      credits: job.reservedCredits ?? 0,
      note: `${job.kind} cancelled`,
    });
  }

  const updatedJob = await runtime.generationJobs.update(job.id, {
    billingState: 'released',
    updatedByUserId: input.userId,
  });

  return {
    action: 'cancel',
    job: updatedJob ?? cancelledJob,
  };
}

async function getProjectGenerationJobOrThrow(
  runtime: ReturnType<typeof getPlatformRuntime>,
  input: {
    organizationId: string;
    workspaceId: string;
    projectId: string;
    jobId: string;
  }
) {
  const job = await runtime.generationJobs.getById(input.jobId);
  if (
    !job ||
    job.projectId !== input.projectId ||
    job.organizationId !== input.organizationId ||
    job.workspaceId !== input.workspaceId
  ) {
    throw new Error('PROJECT_JOB_NOT_FOUND');
  }

  return job;
}

function isRetryableJob(
  job: GenerationJob
): job is GenerationJob & {
  kind: 'script-generation' | 'storyboard-generation' | 'video-generation';
  status: 'failed' | 'cancelled';
} {
  return (
    (
      job.kind === 'script-generation' ||
      job.kind === 'storyboard-generation' ||
      job.kind === 'video-generation'
    ) &&
    (job.status === 'failed' || job.status === 'cancelled')
  );
}

function isCancelableJob(job: GenerationJob) {
  return job.status === 'queued' || job.status === 'running';
}

function parseJobSnapshot(value: Record<string, unknown>): {
  payload?: ScriptGenerationRequest | StoryboardGenerateRequestV2 | VideoGenerationRequest;
  metadata: Record<string, unknown>;
} {
  return {
    payload: value.payload as ScriptGenerationRequest | StoryboardGenerateRequestV2 | VideoGenerationRequest | undefined,
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

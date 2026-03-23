import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequest } from '@/features/storyboard/contracts';
import { estimateJobCredits } from '@/server/billing/catalog';
import { captureJobCredits, releaseJobCredits, reserveJobCredits } from '@/server/billing/service';
import { runScriptGeneration } from '@/server/script-generation/application/run-script-generation';
import { runStoryboardGeneration } from '@/server/storyboard/application/run-storyboard-generation';
import { getPlatformRuntime, resolvePlatformLLMConfig } from '@/server/shared/platform';

export type ProjectGenerationKind = 'script-generation' | 'storyboard-generation';

export async function createPersistedGenerationJob(input: {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  kind: ProjectGenerationKind;
  body: ScriptGenerationRequest | StoryboardGenerateRequest;
}) {
  const runtime = getPlatformRuntime();
  const estimatedCredits = estimateJobCredits(input.kind, {
    episodeCount:
      input.kind === 'script-generation'
        ? (input.body as ScriptGenerationRequest).config.episodeCount
        : 1,
  });

  const job = await runtime.generationJobs.create({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    kind: input.kind,
    requestedByUserId: input.userId,
    inputSnapshot: {
      payload: input.body,
    },
    billingState: 'reserved',
    reservedCredits: estimatedCredits,
  });

  await reserveJobCredits({
    organizationId: input.organizationId,
    userId: input.userId,
    generationJobId: job.id,
    credits: estimatedCredits,
    note: `${input.kind} reserved`,
  });

  await runtime.projects.update(input.projectId, {
    latestGenerationJobId: job.id,
    updatedByUserId: input.userId,
  });

  return job;
}

export async function processPersistedGenerationJob(jobId: string): Promise<void> {
  const runtime = getPlatformRuntime();
  const job = await runtime.generationJobs.getById(jobId);
  if (!job) {
    return;
  }

  const project = await runtime.projects.getById(job.projectId);
  if (!project) {
    await failAndRelease(jobId, 'PROJECT_NOT_FOUND');
    return;
  }

  const planKey = (await runtime.subscriptions.getCurrentByOrganizationId(job.organizationId))?.planKey ?? 'trial';
  const platformContext = {
    requestId: `job:${job.id}`,
    traceId: `job:${job.id}`,
    clientIp: 'server',
    userAgent: 'worker',
    referer: null,
    locale: null,
    organizationId: job.organizationId,
    workspaceId: job.workspaceId,
    projectId: job.projectId,
    userId: job.requestedByUserId ?? null,
    sessionId: job.requestedBySessionId ?? null,
    plan: mapPlanKeyToPlatformPlan(planKey),
    source: 'default' as const,
  };
  const llmResolution = resolvePlatformLLMConfig(platformContext);
  if (llmResolution.error || !llmResolution.config) {
    await failAndRelease(jobId, llmResolution.error ?? 'LLM_CONFIG_MISSING');
    return;
  }

  const onProgress = async (progress: {
    progress: number;
    currentStep: string;
    outputSummary?: string;
  }) => {
    await runtime.generationJobs.update(job.id, {
      progress: progress.progress,
      currentStep: progress.currentStep,
      outputSummary: progress.outputSummary,
      updatedByUserId: job.requestedByUserId,
    });
  };

  try {
    await runtime.generationJobs.markRunning(job.id, undefined, job.requestedByUserId);

    if (job.kind === 'script-generation') {
      const body = job.inputSnapshot.payload as ScriptGenerationRequest | undefined;
      if (!body) {
        throw new Error('SCRIPT_JOB_PAYLOAD_MISSING');
      }

      await runScriptGeneration({
        body,
        context: platformContext,
        jobId: job.id,
        send: () => undefined,
        llmConfig: llmResolution.config,
        usageMeter: runtime.usageMeter,
        onProgress,
        onArtifact: async (artifact) => {
          await runtime.generationArtifacts.create({
            organizationId: job.organizationId,
            workspaceId: job.workspaceId,
            projectId: job.projectId,
            generationJobId: job.id,
            kind: artifact.kind,
            format: artifact.format,
            title: artifact.title,
            content: artifact.content,
            metadata: artifact.metadata,
            createdByUserId: job.requestedByUserId,
          });
        },
      });
    } else if (job.kind === 'storyboard-generation') {
      const body = job.inputSnapshot.payload as StoryboardGenerateRequest | undefined;
      if (!body) {
        throw new Error('STORYBOARD_JOB_PAYLOAD_MISSING');
      }

      let blockedByPolicy = false;
      let blockedMessage = 'Storyboard blocked by policy';

      await runStoryboardGeneration({
        body,
        context: platformContext,
        jobId: job.id,
        send: (event) => {
          if (event.step === 'content_policy_blocked') {
            blockedByPolicy = true;
            blockedMessage = event.message ?? blockedMessage;
          }
        },
        llmConfig: llmResolution.config,
        usageMeter: runtime.usageMeter,
        onProgress,
        onArtifact: async (artifact) => {
          await runtime.generationArtifacts.create({
            organizationId: job.organizationId,
            workspaceId: job.workspaceId,
            projectId: job.projectId,
            generationJobId: job.id,
            kind: artifact.kind,
            format: artifact.format,
            title: artifact.title,
            content: artifact.content,
            metadata: artifact.metadata,
            createdByUserId: job.requestedByUserId,
          });
        },
      });

      if (blockedByPolicy) {
        throw new Error(blockedMessage);
      }
    }

    await captureJobCredits({
      organizationId: job.organizationId,
      userId: job.requestedByUserId,
      generationJobId: job.id,
      credits: job.reservedCredits ?? 0,
      note: `${job.kind} captured`,
    });

    await runtime.generationJobs.markSucceeded(job.id, {
      progress: 100,
      currentStep: 'done',
      outputSummary: job.kind === 'script-generation' ? 'Script generated' : 'Storyboard generated',
      settledCredits: job.reservedCredits ?? 0,
      billingState: 'captured',
      updatedByUserId: job.requestedByUserId,
    });
  } catch (error) {
    await failAndRelease(job.id, error instanceof Error ? error.message : 'GENERATION_FAILED');
  }
}

async function failAndRelease(jobId: string, errorMessage: string) {
  const runtime = getPlatformRuntime();
  const job = await runtime.generationJobs.getById(jobId);
  if (!job) {
    return;
  }

  if ((job.reservedCredits ?? 0) > 0 && job.billingState !== 'released') {
    await releaseJobCredits({
      organizationId: job.organizationId,
      userId: job.requestedByUserId,
      generationJobId: job.id,
      credits: job.reservedCredits ?? 0,
      note: `${job.kind} released`,
    });
  }

  await runtime.generationJobs.markFailed(job.id, {
    errorMessage,
    billingState: 'released',
    updatedByUserId: job.requestedByUserId,
  });
}

function mapPlanKeyToPlatformPlan(planKey: string): 'free' | 'pro' | 'team' | 'enterprise' {
  switch (planKey) {
    case 'studio':
      return 'team';
    case 'pro':
      return 'pro';
    case 'trial':
    default:
      return 'free';
  }
}

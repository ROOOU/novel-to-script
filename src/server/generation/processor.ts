import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequestV2 } from '@/features/storyboard/contracts';
import { estimateJobCredits } from '@/server/billing/catalog';
import { captureJobCredits, releaseJobCredits, reserveJobCredits } from '@/server/billing/service';
import { runScriptGeneration } from '@/server/script-generation/application/run-script-generation';
import { runStoryboardGeneration } from '@/server/storyboard/application/run-storyboard-generation';
import { getPlatformRuntime, resolvePlatformLLMConfig, type GenerationArtifact } from '@/server/shared/platform';

export type ProjectGenerationKind = 'script-generation' | 'storyboard-generation';

interface PersistedGenerationJobSnapshot {
  payload?: ScriptGenerationRequest | StoryboardGenerateRequestV2;
  metadata?: Record<string, unknown>;
}

interface NovelToStoryboardPipelineMetadata {
  pipelineMode: 'novel-to-storyboard';
  storyboardPayload?: Partial<StoryboardGenerateRequestV2>;
}

export async function createPersistedGenerationJob(input: {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  kind: ProjectGenerationKind;
  body: ScriptGenerationRequest | StoryboardGenerateRequestV2;
  metadata?: Record<string, unknown>;
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
      metadata: input.metadata ?? {},
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

  if (job.status === 'cancelled') {
    if (job.billingState !== 'released' && (job.reservedCredits ?? 0) > 0) {
      await releaseJobCredits({
        organizationId: job.organizationId,
        userId: job.requestedByUserId,
        generationJobId: job.id,
        credits: job.reservedCredits ?? 0,
        note: `${job.kind} cancelled`,
      });

      await runtime.generationJobs.update(job.id, {
        billingState: 'released',
        updatedByUserId: job.requestedByUserId,
      });
    }

    return;
  }

  const planKey =
    (await runtime.subscriptions.getCurrentByOrganizationId(job.organizationId))?.planKey ?? 'free';
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

  const snapshot = parseJobSnapshot(job.inputSnapshot);
  const onProgress = async (progress: {
    progress: number;
    currentStep: string;
    outputSummary?: string;
  }) => {
    const latestJob = await runtime.generationJobs.getById(job.id);
    if (latestJob?.status === 'cancelled') {
      throw new Error('JOB_CANCELLED');
    }

    await runtime.generationJobs.update(job.id, {
      progress: progress.progress,
      currentStep: progress.currentStep,
      outputSummary: progress.outputSummary,
      updatedByUserId: job.requestedByUserId,
    });
  };

  const createdArtifacts: GenerationArtifact[] = [];

  try {
    await runtime.generationJobs.markRunning(job.id, undefined, job.requestedByUserId);

    if (job.kind === 'script-generation') {
      const body = snapshot.payload as ScriptGenerationRequest | undefined;
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
          const created = await runtime.generationArtifacts.create({
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
          createdArtifacts.push(created);
        },
      });
    } else if (job.kind === 'storyboard-generation') {
      const body = snapshot.payload as StoryboardGenerateRequestV2 | undefined;
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
          const created = await runtime.generationArtifacts.create({
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
          createdArtifacts.push(created);
        },
      });

      if (blockedByPolicy) {
        throw new Error(blockedMessage);
      }
    }

    const latestJob = await runtime.generationJobs.getById(job.id);
    if (latestJob?.status === 'cancelled') {
      return;
    }

    await writeDerivedArtifactRelations(job, createdArtifacts, snapshot.payload);

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

    if (job.kind === 'script-generation') {
      await maybeRunNovelToStoryboardPipeline(job, createdArtifacts, snapshot.metadata ?? {});
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'JOB_CANCELLED') {
      return;
    }

    await failAndRelease(job.id, error instanceof Error ? error.message : 'GENERATION_FAILED');
  }
}

async function maybeRunNovelToStoryboardPipeline(
  job: Awaited<ReturnType<ReturnType<typeof getPlatformRuntime>['generationJobs']['getById']>>,
  createdArtifacts: GenerationArtifact[],
  metadata: Record<string, unknown>
) {
  if (!job) {
    return;
  }

  const pipeline = parseNovelToStoryboardPipelineMetadata(metadata);
  if (!pipeline) {
    return;
  }

  const scriptArtifactIds = createdArtifacts
    .filter((artifact) => artifact.kind === 'script')
    .map((artifact) => artifact.id);
  if (scriptArtifactIds.length === 0) {
    return;
  }

  const downstreamJob = await createPersistedGenerationJob({
    organizationId: job.organizationId,
    workspaceId: job.workspaceId,
    projectId: job.projectId,
    userId: job.requestedByUserId ?? 'system',
    kind: 'storyboard-generation',
    body: {
      scriptArtifactIds,
      visualStyle: pipeline.storyboardPayload?.visualStyle,
      colorTone: pipeline.storyboardPayload?.colorTone,
      genreLabel: pipeline.storyboardPayload?.genreLabel,
      safeMode: pipeline.storyboardPayload?.safeMode,
    },
    metadata: {
      pipelineMode: 'novel-to-storyboard',
      upstreamJobId: job.id,
    },
  });

  await processPersistedGenerationJob(downstreamJob.id);
}

async function writeDerivedArtifactRelations(
  job: Awaited<ReturnType<ReturnType<typeof getPlatformRuntime>['generationJobs']['getById']>>,
  createdArtifacts: GenerationArtifact[],
  payload?: ScriptGenerationRequest | StoryboardGenerateRequestV2
) {
  if (!job || createdArtifacts.length === 0) {
    return;
  }

  const runtime = getPlatformRuntime();
  const relationInputs =
    job.kind === 'script-generation'
      ? buildScriptArtifactRelationInputs(job, createdArtifacts)
      : buildStoryboardArtifactRelationInputs(job, createdArtifacts, payload as StoryboardGenerateRequestV2 | undefined);

  if (relationInputs.length === 0) {
    return;
  }

  await runtime.artifactRelations.createMany(relationInputs);
}

function buildScriptArtifactRelationInputs(
  job: NonNullable<Awaited<ReturnType<ReturnType<typeof getPlatformRuntime>['generationJobs']['getById']>>>,
  createdArtifacts: GenerationArtifact[]
) {
  const analysisArtifact = createdArtifacts.find((artifact) => artifact.kind === 'analysis');
  const outlineArtifact = createdArtifacts.find((artifact) => artifact.kind === 'outline');
  const scriptArtifacts = createdArtifacts.filter((artifact) => artifact.kind === 'script');
  const relationInputs = [];

  if (analysisArtifact && outlineArtifact) {
    relationInputs.push({
      projectId: job.projectId,
      upstreamArtifactId: analysisArtifact.id,
      downstreamArtifactId: outlineArtifact.id,
      relationType: 'derived_from' as const,
      metadata: {
        generationJobId: job.id,
      },
      createdByUserId: job.requestedByUserId,
    });
  }

  if (outlineArtifact) {
    for (const scriptArtifact of scriptArtifacts) {
      relationInputs.push({
        projectId: job.projectId,
        upstreamArtifactId: outlineArtifact.id,
        downstreamArtifactId: scriptArtifact.id,
        relationType: 'derived_from' as const,
        metadata: {
          generationJobId: job.id,
          episode: scriptArtifact.metadata?.episode ?? null,
        },
        createdByUserId: job.requestedByUserId,
      });
    }
  }

  return relationInputs;
}

function buildStoryboardArtifactRelationInputs(
  job: NonNullable<Awaited<ReturnType<ReturnType<typeof getPlatformRuntime>['generationJobs']['getById']>>>,
  createdArtifacts: GenerationArtifact[],
  payload?: StoryboardGenerateRequestV2
) {
  const storyboardArtifacts = createdArtifacts.filter((artifact) => artifact.kind === 'storyboard');
  if (storyboardArtifacts.length === 0) {
    return [];
  }

  const sourceScriptArtifactIds = extractSourceScriptArtifactIds(storyboardArtifacts, payload);
  if (sourceScriptArtifactIds.length === 0) {
    return [];
  }

  return storyboardArtifacts.flatMap((artifact) =>
    sourceScriptArtifactIds.map((upstreamArtifactId) => ({
      projectId: job.projectId,
      upstreamArtifactId,
      downstreamArtifactId: artifact.id,
      relationType: 'derived_from' as const,
      metadata: {
        generationJobId: job.id,
      },
      createdByUserId: job.requestedByUserId,
    }))
  );
}

function extractSourceScriptArtifactIds(
  storyboardArtifacts: GenerationArtifact[],
  payload?: StoryboardGenerateRequestV2
) {
  const fromArtifacts = storyboardArtifacts.flatMap((artifact) => {
    const value = artifact.metadata?.sourceScriptArtifactIds;
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  });
  const fromPayload =
    payload && 'scriptArtifactIds' in payload && Array.isArray(payload.scriptArtifactIds)
      ? payload.scriptArtifactIds.filter((entry): entry is string => typeof entry === 'string')
      : [];

  return Array.from(new Set([...fromArtifacts, ...fromPayload]));
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
    case 'creator':
    case 'pro':
      return 'pro';
    case 'free':
    default:
      return 'free';
  }
}

function parseJobSnapshot(value: Record<string, unknown>): PersistedGenerationJobSnapshot {
  return {
    payload: value.payload as ScriptGenerationRequest | StoryboardGenerateRequestV2 | undefined,
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
}

function parseNovelToStoryboardPipelineMetadata(
  metadata: Record<string, unknown>
): NovelToStoryboardPipelineMetadata | null {
  if (metadata.pipelineMode !== 'novel-to-storyboard') {
    return null;
  }

  return {
    pipelineMode: 'novel-to-storyboard',
    storyboardPayload: isRecord(metadata.storyboardPayload)
      ? (metadata.storyboardPayload as Partial<StoryboardGenerateRequestV2>)
      : {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

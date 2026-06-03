import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatformRuntime: vi.fn(),
  resolvePlatformLLMConfig: vi.fn(),
  runScriptGeneration: vi.fn(),
  runStoryboardGeneration: vi.fn(),
  runScriptGenerationDevFallback: vi.fn(),
  runStoryboardGenerationDevFallback: vi.fn(),
  shouldUseDevGenerationFallback: vi.fn(),
  reserveJobCredits: vi.fn(),
  captureJobCredits: vi.fn(),
  releaseJobCredits: vi.fn(),
  getProjectGenerationScheduler: vi.fn(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
  resolvePlatformLLMConfig: (...args: unknown[]) => mocks.resolvePlatformLLMConfig(...args),
}));

vi.mock('@/server/script-generation/application/run-script-generation', () => ({
  runScriptGeneration: (...args: unknown[]) => mocks.runScriptGeneration(...args),
}));

vi.mock('@/server/storyboard/application/run-storyboard-generation', () => ({
  runStoryboardGeneration: (...args: unknown[]) => mocks.runStoryboardGeneration(...args),
}));

vi.mock('@/server/generation/dev-fallback', () => ({
  DEV_FALLBACK_MODEL_NAME: 'local-dev-fallback',
  runScriptGenerationDevFallback: (...args: unknown[]) =>
    mocks.runScriptGenerationDevFallback(...args),
  runStoryboardGenerationDevFallback: (...args: unknown[]) =>
    mocks.runStoryboardGenerationDevFallback(...args),
  shouldUseDevGenerationFallback: (...args: unknown[]) =>
    mocks.shouldUseDevGenerationFallback(...args),
}));

vi.mock('@/server/billing/service', () => ({
  reserveJobCredits: (...args: unknown[]) => mocks.reserveJobCredits(...args),
  captureJobCredits: (...args: unknown[]) => mocks.captureJobCredits(...args),
  releaseJobCredits: (...args: unknown[]) => mocks.releaseJobCredits(...args),
}));

vi.mock('@/server/generation/queue', () => ({
  getProjectGenerationScheduler: () => mocks.getProjectGenerationScheduler(),
}));

import { createPersistedGenerationJob, processPersistedGenerationJob } from '@/server/generation/processor';

describe('processPersistedGenerationJob', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvePlatformLLMConfig.mockReturnValue({ config: { modelName: 'test-model' } });
    mocks.shouldUseDevGenerationFallback.mockReturnValue(false);
    mocks.getProjectGenerationScheduler.mockReturnValue({
      schedule: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getMode: vi.fn().mockReturnValue('inline'),
    });
  });

  it('creates zero-credit script jobs in local dev fallback mode when no LLM provider is configured', async () => {
    mocks.shouldUseDevGenerationFallback.mockReturnValue(true);

    const createJob = vi.fn().mockResolvedValue(
      buildJob({
        id: 'job_dev',
        kind: 'script-generation',
        reservedCredits: 0,
      })
    );
    const runtime = {
      generationJobs: {
        create: createJob,
      },
      projects: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    mocks.getPlatformRuntime.mockReturnValue(runtime);

    const job = await createPersistedGenerationJob({
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      userId: 'user_1',
      kind: 'script-generation',
      body: {
        text: '韩立在荒原边缘停步，察觉远处异动。',
        genre: 'xianxia',
        config: {
          genre: 'xianxia',
          episodeCount: 1,
          episodeDuration: '1:00-1:30',
          style: 'highEnergy',
          includeDirectorNotes: true,
        },
      },
    });

    expect(job).toMatchObject({
      id: 'job_dev',
      reservedCredits: 0,
    });
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        reservedCredits: 0,
      })
    );
    expect(mocks.reserveJobCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        generationJobId: 'job_dev',
        credits: 0,
      })
    );
  });

  it('runs the script pipeline through local dev fallback artifacts when no LLM provider is configured', async () => {
    mocks.shouldUseDevGenerationFallback.mockReturnValue(true);
    mocks.resolvePlatformLLMConfig.mockReturnValue({
      config: null,
      error: '服务端未配置可用的 LLM Provider，请设置 LLM_API_KEY 或 LLM_FALLBACKS。',
    });

    const job = buildJob({
      id: 'job_script',
      kind: 'script-generation',
      reservedCredits: 0,
      inputSnapshot: {
        payload: {
          text: '韩立在荒原边缘停步，察觉远处斗法异动。银月提醒他先观察局势，再决定是否介入。',
          genre: 'xianxia',
          config: {
            genre: 'xianxia',
            episodeCount: 1,
            episodeDuration: '1:00-1:30',
            style: 'highEnergy',
            includeDirectorNotes: true,
          },
        },
        metadata: {
          pipelineMode: 'novel-to-storyboard',
          storyboardPayload: {
            visualStyle: 'cinematic realism',
            colorTone: 'cold tone',
          },
        },
      },
    });
    const project = { id: 'proj_1' };
    let createdIndex = 0;
    const createArtifact = vi.fn().mockImplementation(async (input: Record<string, unknown>) =>
      buildArtifact({
        id: `artifact_${createdIndex += 1}`,
        generationJobId: job.id,
        kind: input.kind,
        format: input.format,
        title: input.title,
        content: input.content,
        metadata: input.metadata ?? {},
      })
    );
    const createJob = vi.fn().mockResolvedValue(
      buildJob({
        id: 'job_storyboard',
        kind: 'storyboard-generation',
        status: 'queued',
        reservedCredits: 0,
        inputSnapshot: {
          payload: {
            scriptArtifactIds: ['artifact_5'],
            visualStyle: 'cinematic realism',
            colorTone: 'cold tone',
          },
          metadata: {
            pipelineMode: 'novel-to-storyboard',
            upstreamJobId: 'job_script',
          },
        },
      })
    );
    const scheduler = {
      schedule: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getMode: vi.fn().mockReturnValue('inline'),
    };

    mocks.getProjectGenerationScheduler.mockReturnValue(scheduler);
    mocks.runScriptGenerationDevFallback.mockImplementation(
      async ({ onArtifact }: { onArtifact: (artifact: unknown) => Promise<void> }) => {
        await onArtifact({
          kind: 'analysis',
          title: 'Analysis',
          format: 'application/json',
          content: '{}',
        });
        await onArtifact({
          kind: 'story_bible',
          title: 'Story Bible',
          format: 'application/json',
          content: '{}',
        });
        await onArtifact({
          kind: 'outline',
          title: 'Outline',
          format: 'application/json',
          content: '[]',
        });
        await onArtifact({
          kind: 'scene_cards',
          title: 'Scene Cards',
          format: 'application/json',
          content: '[]',
        });
        await onArtifact({
          kind: 'script',
          title: 'Episode 1',
          format: 'text/plain',
          content: 'script body',
          metadata: { episode: 1, devFallback: true },
        });
      }
    );

    const runtime = {
      generationJobs: {
        getById: vi.fn().mockResolvedValue(job),
        create: createJob,
        update: vi.fn().mockResolvedValue(job),
        markRunning: vi.fn().mockResolvedValue(undefined),
        markSucceeded: vi.fn().mockResolvedValue(undefined),
        markFailed: vi.fn().mockResolvedValue(undefined),
      },
      projects: {
        getById: vi.fn().mockResolvedValue(project),
        update: vi.fn().mockResolvedValue(undefined),
      },
      subscriptions: {
        getCurrentByOrganizationId: vi.fn().mockResolvedValue({ planKey: 'creator' }),
      },
      generationArtifacts: {
        create: createArtifact,
      },
      artifactRelations: {
        createMany: vi.fn().mockResolvedValue([]),
      },
      usageMeter: {
        record: vi.fn(),
      },
    };
    mocks.getPlatformRuntime.mockReturnValue(runtime);

    await processPersistedGenerationJob(job.id);

    expect(runtime.generationJobs.update).toHaveBeenCalledWith(
      'job_script',
      expect.objectContaining({
        modelName: 'local-dev-fallback',
      })
    );
    expect(mocks.runScriptGeneration).not.toHaveBeenCalled();
    expect(mocks.runScriptGenerationDevFallback).toHaveBeenCalledTimes(1);
    expect(createArtifact).toHaveBeenCalledTimes(5);
    expect(createArtifact).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        kind: 'script',
      })
    );
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        reservedCredits: 0,
        kind: 'storyboard-generation',
        inputSnapshot: expect.objectContaining({
          payload: expect.objectContaining({
            scriptArtifactIds: ['artifact_5'],
          }),
        }),
      })
    );
    expect(scheduler.schedule).toHaveBeenCalledWith('job_storyboard');
  });

  it('schedules the pipeline storyboard follow-up job instead of running it inline', async () => {
    const job = buildJob({
      id: 'job_script',
      kind: 'script-generation',
      inputSnapshot: {
        payload: {
          text: 'source novel',
          genre: 'urban',
          config: {
            genre: 'urban',
            episodeCount: 2,
            episodeDuration: '1:30-2:00',
            style: 'dramatic',
            includeDirectorNotes: true,
          },
        },
        metadata: {
          pipelineMode: 'novel-to-storyboard',
          storyboardPayload: {
            visualStyle: 'cinematic realism',
            colorTone: 'warm tone',
          },
        },
      },
    });
    const project = { id: 'proj_1' };
    const createArtifact = vi
      .fn()
      .mockResolvedValueOnce(buildArtifact({ id: 'analysis_1', kind: 'analysis', generationJobId: job.id }))
      .mockResolvedValueOnce(buildArtifact({ id: 'outline_1', kind: 'outline', generationJobId: job.id }))
      .mockResolvedValueOnce(
        buildArtifact({
          id: 'script_1',
          kind: 'script',
          generationJobId: job.id,
          metadata: { episode: 1 },
        })
      );
    const createJob = vi.fn().mockResolvedValue(
      buildJob({
        id: 'job_storyboard',
        kind: 'storyboard-generation',
        status: 'queued',
        inputSnapshot: {
          payload: {
            scriptArtifactIds: ['script_1'],
            visualStyle: 'cinematic realism',
            colorTone: 'warm tone',
          },
          metadata: {
            pipelineMode: 'novel-to-storyboard',
            upstreamJobId: 'job_script',
          },
        },
      })
    );
    const scheduler = {
      schedule: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getMode: vi.fn().mockReturnValue('inline'),
    };

    mocks.getProjectGenerationScheduler.mockReturnValue(scheduler);
    mocks.runScriptGeneration.mockImplementation(async ({ onArtifact }: { onArtifact: (artifact: unknown) => Promise<void> }) => {
      await onArtifact({
        kind: 'analysis',
        title: 'Analysis',
        format: 'application/json',
        content: '{}',
      });
      await onArtifact({
        kind: 'outline',
        title: 'Outline',
        format: 'application/json',
        content: '[]',
      });
      await onArtifact({
        kind: 'script',
        title: 'Episode 1',
        format: 'text/plain',
        content: 'script body',
        metadata: { episode: 1 },
      });
    });

    const runtime = {
      generationJobs: {
        getById: vi.fn().mockResolvedValue(job),
        create: createJob,
        update: vi.fn().mockResolvedValue(job),
        markRunning: vi.fn().mockResolvedValue(undefined),
        markSucceeded: vi.fn().mockResolvedValue(undefined),
        markFailed: vi.fn().mockResolvedValue(undefined),
      },
      projects: {
        getById: vi.fn().mockResolvedValue(project),
        update: vi.fn().mockResolvedValue(undefined),
      },
      subscriptions: {
        getCurrentByOrganizationId: vi.fn().mockResolvedValue({ planKey: 'creator' }),
      },
      generationArtifacts: {
        create: createArtifact,
      },
      artifactRelations: {
        createMany: vi.fn().mockResolvedValue([]),
      },
      usageMeter: {
        record: vi.fn(),
      },
    };
    mocks.getPlatformRuntime.mockReturnValue(runtime);

    await processPersistedGenerationJob(job.id);

    expect(runtime.generationJobs.update).toHaveBeenCalledWith(
      'job_script',
      expect.objectContaining({
        modelName: 'test-model',
      })
    );

    expect(createJob).toHaveBeenCalledTimes(1);
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'storyboard-generation',
        inputSnapshot: expect.objectContaining({
          payload: expect.objectContaining({
            scriptArtifactIds: ['script_1'],
            visualStyle: 'cinematic realism',
            colorTone: 'warm tone',
          }),
          metadata: expect.objectContaining({
            pipelineMode: 'novel-to-storyboard',
            upstreamJobId: 'job_script',
          }),
        }),
      })
    );
    const downstreamCreateArg = createJob.mock.calls[0]?.[0];
    expect(downstreamCreateArg).toBeTruthy();
    expect((downstreamCreateArg as { inputSnapshot: { metadata: Record<string, unknown> } }).inputSnapshot.metadata)
      .not.toHaveProperty('executionMode');
    expect(scheduler.schedule).toHaveBeenCalledWith('job_storyboard');
    expect(mocks.captureJobCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        generationJobId: 'job_script',
      })
    );
  });
});

function buildJob(overrides: Record<string, unknown>) {
  return {
    id: 'job_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    kind: 'script-generation',
    status: 'queued',
    requestedByUserId: 'user_1',
    requestedBySessionId: null,
    inputSnapshot: {
      payload: {},
      metadata: {},
    },
    billingState: 'reserved',
    reservedCredits: 12,
    progress: 0,
    currentStep: null,
    outputSummary: null,
    settledCredits: 0,
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

function buildArtifact(overrides: Record<string, unknown>) {
  return {
    id: 'artifact_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    generationJobId: 'job_1',
    kind: 'script',
    format: 'text/plain',
    title: 'Artifact',
    content: 'artifact body',
    version: 1,
    metadata: {},
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

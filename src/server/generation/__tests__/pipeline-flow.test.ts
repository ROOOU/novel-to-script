import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ArtifactRelation,
  GenerationArtifact,
  GenerationJob,
} from '@/server/shared/platform/domain';
import type { ScriptGenerationExecutionOptions } from '@/server/script-generation/application/types';
import type { StoryboardGenerationExecutionOptions } from '@/server/storyboard/application/types';

type ScriptGenerationInput = ScriptGenerationExecutionOptions;
type StoryboardGenerationInput = StoryboardGenerationExecutionOptions;

const mocks = vi.hoisted(() => ({
  runScriptGeneration: vi.fn(),
  runStoryboardGeneration: vi.fn(),
  scheduledJobIds: [] as string[],
  scheduler: {
    schedule: vi.fn(async (jobId: string) => {
      mocks.scheduledJobIds.push(jobId);
    }),
    close: vi.fn(async () => undefined),
    getMode: vi.fn(() => 'inline' as const),
  },
}));

vi.mock('@/server/script-generation/application/run-script-generation', () => ({
  runScriptGeneration: (...args: unknown[]) => mocks.runScriptGeneration(...args),
}));

vi.mock('@/server/storyboard/application/run-storyboard-generation', () => ({
  runStoryboardGeneration: (...args: unknown[]) => mocks.runStoryboardGeneration(...args),
}));

vi.mock('@/server/generation/queue', () => ({
  getProjectGenerationScheduler: () => mocks.scheduler,
  resetProjectGenerationSchedulerForTests: () => {
    mocks.scheduledJobIds.length = 0;
  },
}));

describe('novel-to-storyboard pipeline integration', () => {
  let previousStorePath: string | undefined;
  let previousApiKey: string | undefined;
  let previousRedisUrl: string | undefined;
  let tempDir: string | null = null;

  beforeEach(() => {
    previousStorePath = process.env.NOVELSCRIPT_STORE_PATH;
    previousApiKey = process.env.LLM_API_KEY;
    previousRedisUrl = process.env.REDIS_URL;
    mocks.runScriptGeneration.mockReset();
    mocks.runStoryboardGeneration.mockReset();
    mocks.scheduler.schedule.mockClear();
    mocks.scheduler.close.mockClear();
    mocks.scheduler.getMode.mockClear();
    mocks.scheduledJobIds.length = 0;
  });

  afterEach(async () => {
    if (previousStorePath === undefined) {
      delete process.env.NOVELSCRIPT_STORE_PATH;
    } else {
      process.env.NOVELSCRIPT_STORE_PATH = previousStorePath;
    }

    if (previousApiKey === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = previousApiKey;
    }

    if (previousRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousRedisUrl;
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('processes the full pipeline inline, settles credits, and persists relations', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-pipeline-flow-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');
    process.env.LLM_API_KEY = 'sk-test';
    delete process.env.REDIS_URL;

    mocks.runScriptGeneration.mockImplementation(async (input: ScriptGenerationInput) => {
      await input.onProgress?.({ progress: 30, currentStep: 'analyzed', outputSummary: 'analysis ready' });
      await input.onArtifact?.({
        kind: 'analysis',
        title: '小说分析',
        format: 'application/json',
        content: '{"title":"测试分析"}',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'story_bible',
        title: '故事圣经',
        format: 'application/json',
        content: '{"projectSummary":"测试分析"}',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'outline',
        title: '分集大纲',
        format: 'application/json',
        content: '[{"episodeNumber":1,"title":"第一集"}]',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'scene_cards',
        title: '场景卡',
        format: 'application/json',
        content: '[{"sceneId":"scene-01","title":"第一集"}]',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'script',
        title: '第1集剧本',
        format: 'text/plain',
        content: '【场景一】测试剧本',
        metadata: { episode: 1 },
      });
      await input.onProgress?.({ progress: 100, currentStep: 'done', outputSummary: 'Generated 1 episodes' });
    });

    mocks.runStoryboardGeneration.mockImplementation(async (input: StoryboardGenerationInput) => {
      await input.onProgress?.({ progress: 50, currentStep: 'generating', outputSummary: 'storyboard drafting' });
      await input.onArtifact?.({
        kind: 'storyboard',
        title: '分镜提示词',
        format: 'text/plain',
        content: '镜头1｜远景｜测试分镜',
        metadata: {
          sourceScriptArtifactIds: input.body.scriptArtifactIds ?? [],
        },
      });
      await input.onArtifact?.({
        kind: 'shot_plan',
        title: '结构化镜头计划',
        format: 'application/json',
        content: '[]',
        metadata: {
          sourceScriptArtifactIds: input.body.scriptArtifactIds ?? [],
        },
      });
      await input.onArtifact?.({
        kind: 'prompt_pack',
        title: '视频提示词包',
        format: 'application/json',
        content: '[]',
        metadata: {
          sourceScriptArtifactIds: input.body.scriptArtifactIds ?? [],
          targetPlatform: 'generic-video',
        },
      });
      await input.onProgress?.({ progress: 100, currentStep: 'done', outputSummary: 'storyboard generated' });
    });

    vi.resetModules();
    const { getPlatformRuntime } = await import('@/server/shared/platform');
    const { createProject, getProjectBundle, saveProjectSource } = await import('@/server/projects/service');
    const { grantCredits } = await import('@/server/billing/service');
    const { createNovelToStoryboardPipeline } = await import('@/server/generation/pipeline-service');
    const {
      resetProjectGenerationSchedulerForTests,
    } = await import('@/server/generation/queue');
    const { processPersistedGenerationJob } = await import('@/server/generation/service');

    resetProjectGenerationSchedulerForTests();
    const runtime = getPlatformRuntime();

    const user = await runtime.users.create({
      email: 'pipeline@example.com',
      displayName: 'Pipeline User',
      preferredLocale: 'zh-CN',
      createdByUserId: null,
    });
    const organization = await runtime.organizations.create({
      slug: 'pipeline-org',
      name: 'Pipeline Org',
      ownerUserId: user.id,
      billingLocale: 'zh-CN',
      billingCurrency: 'USD',
      pricingRegion: 'global',
      createdByUserId: user.id,
    });
    const workspace = await runtime.workspaces.create({
      organizationId: organization.id,
      slug: 'pipeline-workspace',
      name: 'Pipeline Workspace',
      defaultLocale: 'zh-CN',
      createdByUserId: user.id,
    });

    const project = await createProject({
      organizationId: organization.id,
      workspaceId: workspace.id,
      userId: user.id,
      name: 'Pipeline Flow Project',
      description: 'Integration verification for novel-to-storyboard',
      genre: 'urban',
    });

    await saveProjectSource({
      projectId: project.id,
      organizationId: organization.id,
      workspaceId: workspace.id,
      userId: user.id,
      title: 'Pipeline Source',
      textContent: '林晚重新回到旧厂房，顾承砚在门口等她。',
    });

    await grantCredits({
      organizationId: organization.id,
      userId: user.id,
      credits: 100,
      kind: 'manual_adjustment',
      note: 'pipeline integration test',
    });

    const pipeline = await createNovelToStoryboardPipeline({
      organizationId: organization.id,
      workspaceId: workspace.id,
      projectId: project.id,
      userId: user.id,
      body: {
        text: '林晚重新回到旧厂房，顾承砚在门口等她。',
        genre: 'urban',
        config: {
          genre: 'urban',
          episodeCount: 1,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
        storyboardConfig: {
          visualStyle: 'cinematic realism',
          colorTone: 'warm tone',
          genreLabel: 'urban',
        },
      },
    });

    expect(pipeline.mode).toBe('novel-to-storyboard');
    expect(mocks.scheduler.getMode()).toBe('inline');
    expect(mocks.scheduledJobIds).toEqual([pipeline.job.id]);

    await processPersistedGenerationJob(pipeline.job.id);

    expect(mocks.scheduledJobIds).toHaveLength(2);
    const storyboardJobId = mocks.scheduledJobIds[1];
    await processPersistedGenerationJob(storyboardJobId);

    const bundle = await getProjectBundle(project.id);
    expect(bundle).not.toBeNull();
    if (!bundle) {
      throw new Error('PROJECT_BUNDLE_MISSING');
    }
    const scriptJob = bundle.jobs.find((job: GenerationJob) => job.kind === 'script-generation');
    const storyboardJob = bundle.jobs.find((job: GenerationJob) => job.kind === 'storyboard-generation');
    const analysisArtifact = bundle.artifacts.find((artifact: GenerationArtifact) => artifact.kind === 'analysis');
    const storyBibleArtifact = bundle.artifacts.find((artifact: GenerationArtifact) => artifact.kind === 'story_bible');
    const sceneCardsArtifact = bundle.artifacts.find((artifact: GenerationArtifact) => artifact.kind === 'scene_cards');
    const outlineArtifact = bundle.artifacts.find((artifact: GenerationArtifact) => artifact.kind === 'outline');
    const scriptArtifact = bundle.artifacts.find((artifact: GenerationArtifact) => artifact.kind === 'script');
    const storyboardArtifact = bundle.artifacts.find((artifact: GenerationArtifact) => artifact.kind === 'storyboard');
    const shotPlanArtifact = bundle.artifacts.find((artifact: GenerationArtifact) => artifact.kind === 'shot_plan');
    const promptPackArtifact = bundle.artifacts.find((artifact: GenerationArtifact) => artifact.kind === 'prompt_pack');
    const account = await runtime.creditAccounts.getByOrganizationId(organization.id);
    const storedProject = await runtime.projects.getById(project.id);

    expect(mocks.runScriptGeneration).toHaveBeenCalledTimes(1);
    expect(mocks.runStoryboardGeneration).toHaveBeenCalledTimes(1);
    expect(bundle.jobs).toHaveLength(2);
    expect(scriptJob).toMatchObject({
      status: 'succeeded',
      billingState: 'captured',
      settledCredits: 45,
    });
    expect(storyboardJob).toMatchObject({
      status: 'succeeded',
      billingState: 'captured',
      settledCredits: 8,
    });
    expect(storyboardJob?.inputSnapshot).toMatchObject({
      metadata: {
        pipelineMode: 'novel-to-storyboard',
        upstreamJobId: scriptJob?.id,
      },
    });

    expect(bundle.artifacts.map((artifact: GenerationArtifact) => artifact.kind).sort()).toEqual([
      'analysis',
      'outline',
      'prompt_pack',
      'scene_cards',
      'script',
      'shot_plan',
      'story_bible',
      'storyboard',
    ]);
    expect(storyboardArtifact?.metadata).toMatchObject({
      sourceScriptArtifactIds: [scriptArtifact?.id],
    });
    expect(bundle.artifactRelations).toHaveLength(10);
    expect(
      bundle.artifactRelations
        .map((relation: ArtifactRelation) => ({
          upstreamArtifactId: relation.upstreamArtifactId,
          downstreamArtifactId: relation.downstreamArtifactId,
        }))
        .sort((left: { upstreamArtifactId: string; downstreamArtifactId: string }, right: { upstreamArtifactId: string; downstreamArtifactId: string }) =>
          `${left.upstreamArtifactId}:${left.downstreamArtifactId}`.localeCompare(
            `${right.upstreamArtifactId}:${right.downstreamArtifactId}`
          )
        )
    ).toEqual(
      [
        {
          upstreamArtifactId: analysisArtifact?.id,
          downstreamArtifactId: storyBibleArtifact?.id,
        },
        {
          upstreamArtifactId: scriptArtifact?.id,
          downstreamArtifactId: storyboardArtifact?.id,
        },
        {
          upstreamArtifactId: scriptArtifact?.id,
          downstreamArtifactId: shotPlanArtifact?.id,
        },
        {
          upstreamArtifactId: scriptArtifact?.id,
          downstreamArtifactId: promptPackArtifact?.id,
        },
        {
          upstreamArtifactId: outlineArtifact?.id,
          downstreamArtifactId: sceneCardsArtifact?.id,
        },
        {
          upstreamArtifactId: outlineArtifact?.id,
          downstreamArtifactId: scriptArtifact?.id,
        },
        {
          upstreamArtifactId: analysisArtifact?.id,
          downstreamArtifactId: outlineArtifact?.id,
        },
        {
          upstreamArtifactId: storyBibleArtifact?.id,
          downstreamArtifactId: sceneCardsArtifact?.id,
        },
        {
          upstreamArtifactId: storyboardArtifact?.id,
          downstreamArtifactId: shotPlanArtifact?.id,
        },
        {
          upstreamArtifactId: shotPlanArtifact?.id,
          downstreamArtifactId: promptPackArtifact?.id,
        },
      ].sort((left: { upstreamArtifactId: string | undefined; downstreamArtifactId: string | undefined }, right: { upstreamArtifactId: string | undefined; downstreamArtifactId: string | undefined }) =>
        `${left.upstreamArtifactId}:${left.downstreamArtifactId}`.localeCompare(
          `${right.upstreamArtifactId}:${right.downstreamArtifactId}`
        )
      )
    );

    expect(account).toMatchObject({
      availableCredits: 47,
      reservedCredits: 0,
      grantedCreditsTotal: 100,
      consumedCreditsTotal: 53,
    });
    expect(storedProject?.latestGenerationJobId).toBe(storyboardJob?.id);

    resetProjectGenerationSchedulerForTests();
  });

  it('releases storyboard credits when the downstream pipeline step fails', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-pipeline-flow-fail-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');
    process.env.LLM_API_KEY = 'sk-test';
    delete process.env.REDIS_URL;

    mocks.runScriptGeneration.mockImplementation(async (input: ScriptGenerationInput) => {
      await input.onArtifact?.({
        kind: 'analysis',
        title: '小说分析',
        format: 'application/json',
        content: '{"title":"测试分析"}',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'story_bible',
        title: '故事圣经',
        format: 'application/json',
        content: '{"projectSummary":"测试分析"}',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'outline',
        title: '分集大纲',
        format: 'application/json',
        content: '[{"episodeNumber":1,"title":"第一集"}]',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'scene_cards',
        title: '场景卡',
        format: 'application/json',
        content: '[{"sceneId":"scene-01","title":"第一集"}]',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'script',
        title: '第1集剧本',
        format: 'text/plain',
        content: '【场景一】测试剧本',
        metadata: { episode: 1 },
      });
      await input.onProgress?.({ progress: 100, currentStep: 'done', outputSummary: 'Generated 1 episodes' });
    });

    mocks.runStoryboardGeneration.mockImplementation(async () => {
      throw new Error('STORYBOARD_PROVIDER_FAILED');
    });

    vi.resetModules();
    const { getPlatformRuntime } = await import('@/server/shared/platform');
    const { createProject, getProjectBundle, saveProjectSource } = await import('@/server/projects/service');
    const { grantCredits } = await import('@/server/billing/service');
    const { createNovelToStoryboardPipeline } = await import('@/server/generation/pipeline-service');
    const {
      resetProjectGenerationSchedulerForTests,
    } = await import('@/server/generation/queue');
    const { processPersistedGenerationJob } = await import('@/server/generation/service');

    resetProjectGenerationSchedulerForTests();
    const runtime = getPlatformRuntime();

    const user = await runtime.users.create({
      email: 'pipeline-fail@example.com',
      displayName: 'Pipeline Fail User',
      preferredLocale: 'zh-CN',
      createdByUserId: null,
    });
    const organization = await runtime.organizations.create({
      slug: 'pipeline-fail-org',
      name: 'Pipeline Fail Org',
      ownerUserId: user.id,
      billingLocale: 'zh-CN',
      billingCurrency: 'USD',
      pricingRegion: 'global',
      createdByUserId: user.id,
    });
    const workspace = await runtime.workspaces.create({
      organizationId: organization.id,
      slug: 'pipeline-fail-workspace',
      name: 'Pipeline Fail Workspace',
      defaultLocale: 'zh-CN',
      createdByUserId: user.id,
    });

    const project = await createProject({
      organizationId: organization.id,
      workspaceId: workspace.id,
      userId: user.id,
      name: 'Pipeline Failure Project',
      description: 'Integration verification for downstream failure',
      genre: 'urban',
    });

    await saveProjectSource({
      projectId: project.id,
      organizationId: organization.id,
      workspaceId: workspace.id,
      userId: user.id,
      title: 'Pipeline Source',
      textContent: '林晚重新回到旧厂房，顾承砚在门口等她。',
    });

    await grantCredits({
      organizationId: organization.id,
      userId: user.id,
      credits: 100,
      kind: 'manual_adjustment',
      note: 'pipeline failure integration test',
    });

    const pipeline = await createNovelToStoryboardPipeline({
      organizationId: organization.id,
      workspaceId: workspace.id,
      projectId: project.id,
      userId: user.id,
      body: {
        text: '林晚重新回到旧厂房，顾承砚在门口等她。',
        genre: 'urban',
        config: {
          genre: 'urban',
          episodeCount: 1,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
        storyboardConfig: {
          visualStyle: 'cinematic realism',
          colorTone: 'warm tone',
          genreLabel: 'urban',
        },
      },
    });

    await processPersistedGenerationJob(pipeline.job.id);

    expect(mocks.scheduledJobIds).toHaveLength(2);
    const storyboardJobId = mocks.scheduledJobIds[1];
    await processPersistedGenerationJob(storyboardJobId);

    const bundle = await getProjectBundle(project.id);
    expect(bundle).not.toBeNull();
    if (!bundle) {
      throw new Error('PROJECT_BUNDLE_MISSING');
    }

    const scriptJob = bundle.jobs.find((job: GenerationJob) => job.kind === 'script-generation');
    const storyboardJob = bundle.jobs.find((job: GenerationJob) => job.kind === 'storyboard-generation');
    const account = await runtime.creditAccounts.getByOrganizationId(organization.id);
    const scriptLedger = scriptJob
      ? await runtime.creditLedger.listByGenerationJobId(scriptJob.id)
      : [];
    const storyboardLedger = storyboardJob
      ? await runtime.creditLedger.listByGenerationJobId(storyboardJob.id)
      : [];

    expect(scriptJob).toMatchObject({
      status: 'succeeded',
      billingState: 'captured',
      settledCredits: 45,
    });
    expect(storyboardJob).toMatchObject({
      status: 'failed',
      billingState: 'released',
      errorMessage: 'STORYBOARD_PROVIDER_FAILED',
    });
    expect(bundle.artifacts.map((artifact: GenerationArtifact) => artifact.kind).sort()).toEqual([
      'analysis',
      'outline',
      'scene_cards',
      'script',
      'story_bible',
    ]);
    expect(bundle.artifactRelations).toHaveLength(5);
    expect(account).toMatchObject({
      availableCredits: 55,
      reservedCredits: 0,
      grantedCreditsTotal: 100,
      consumedCreditsTotal: 45,
    });
    expect(scriptLedger.map((entry) => entry.kind)).toEqual(['job_reserve', 'job_capture']);
    expect(storyboardLedger.map((entry) => entry.kind)).toEqual(['job_reserve', 'job_release']);

    resetProjectGenerationSchedulerForTests();
  });
});

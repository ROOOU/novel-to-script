import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactRelation, GenerationArtifact, GenerationJob } from '@/server/shared/platform/domain';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  runScriptGeneration: vi.fn(),
  runStoryboardGeneration: vi.fn(),
  viewer: null as null | {
    organization: { id: string };
    workspace: { id: string };
    user: { id: string };
    session: { locale: string };
  },
  scheduledJobIds: [] as string[],
  scheduler: {
    schedule: vi.fn(async (jobId: string) => {
      mocks.scheduledJobIds.push(jobId);
    }),
    close: vi.fn(async () => undefined),
    getMode: vi.fn(() => 'inline' as const),
  },
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: (...args: unknown[]) => mocks.requireViewerResponse(...args),
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

describe('project API main flow integration', () => {
  let previousStorePath: string | undefined;
  let previousApiKey: string | undefined;
  let previousRedisUrl: string | undefined;
  let tempDir: string | null = null;

  beforeEach(() => {
    previousStorePath = process.env.NOVELSCRIPT_STORE_PATH;
    previousApiKey = process.env.LLM_API_KEY;
    previousRedisUrl = process.env.REDIS_URL;
    mocks.viewer = null;
    mocks.scheduledJobIds.length = 0;
    mocks.requireViewerResponse.mockReset();
    mocks.runScriptGeneration.mockReset();
    mocks.runStoryboardGeneration.mockReset();
    mocks.scheduler.schedule.mockClear();
    mocks.scheduler.close.mockClear();
    mocks.scheduler.getMode.mockClear();
    mocks.requireViewerResponse.mockImplementation(async () => {
      if (!mocks.viewer) {
        return {
          viewer: null,
          response: new Response(null, { status: 401 }),
        };
      }

      return {
        viewer: mocks.viewer,
        response: null,
      };
    });
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

  it('creates a project, saves source, runs the pipeline, and returns a populated project bundle', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-project-main-flow-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');
    process.env.LLM_API_KEY = 'sk-test';
    delete process.env.REDIS_URL;

    mocks.runScriptGeneration.mockImplementation(async (input: any) => {
      await input.onArtifact?.({
        kind: 'analysis',
        title: '小说分析',
        format: 'application/json',
        content: '{"title":"测试分析"}',
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
        kind: 'script',
        title: '第1集剧本',
        format: 'text/plain',
        content: '【场景一】测试剧本',
        metadata: { episode: 1 },
      });
      await input.onProgress?.({ progress: 100, currentStep: 'done', outputSummary: 'Generated 1 episodes' });
    });

    mocks.runStoryboardGeneration.mockImplementation(async (input: any) => {
      await input.onArtifact?.({
        kind: 'storyboard',
        title: '分镜提示词',
        format: 'text/plain',
        content: '镜头1｜远景｜测试分镜',
        metadata: {
          sourceScriptArtifactIds: input.body.scriptArtifactIds ?? [],
        },
      });
      await input.onProgress?.({ progress: 100, currentStep: 'done', outputSummary: 'storyboard generated' });
    });

    vi.resetModules();
    const { getPlatformRuntime } = await import('@/server/shared/platform');
    const { grantCredits } = await import('@/server/billing/service');
    const { processPersistedGenerationJob } = await import('@/server/generation/service');
    const { POST: createProject } = await import('@/app/api/projects/route');
    const { POST: saveSource } = await import('@/app/api/projects/[projectId]/source/route');
    const { POST: createPipeline } = await import('@/app/api/projects/[projectId]/pipelines/route');
    const { GET: getProjectBundle } = await import('@/app/api/projects/[projectId]/route');

    const runtime = getPlatformRuntime();
    const user = await runtime.users.create({
      email: 'route-flow@example.com',
      displayName: 'Route Flow User',
      preferredLocale: 'zh-CN',
      createdByUserId: null,
    });
    const organization = await runtime.organizations.create({
      slug: 'route-flow-org',
      name: 'Route Flow Org',
      ownerUserId: user.id,
      billingLocale: 'zh-CN',
      billingCurrency: 'USD',
      pricingRegion: 'global',
      createdByUserId: user.id,
    });
    const workspace = await runtime.workspaces.create({
      organizationId: organization.id,
      slug: 'route-flow-workspace',
      name: 'Route Flow Workspace',
      defaultLocale: 'zh-CN',
      createdByUserId: user.id,
    });

    mocks.viewer = {
      organization: { id: organization.id },
      workspace: { id: workspace.id },
      user: { id: user.id },
      session: { locale: 'zh-CN' },
    };

    await grantCredits({
      organizationId: organization.id,
      userId: user.id,
      credits: 100,
      kind: 'manual_adjustment',
      note: 'route integration test credits',
    });

    const createProjectResponse = await createProject(
      new NextRequest('https://app.test/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Route Flow Project',
          description: 'Route-to-route verification',
          genre: 'urban',
        }),
      })
    );
    expect(createProjectResponse.status).toBe(200);
    const createProjectPayload = await createProjectResponse.json();
    expect(createProjectPayload.ok).toBe(true);
    const projectId = createProjectPayload.project.id as string;

    const sourceUpload = new FormData();
    sourceUpload.append('title', '主流程原文');
    sourceUpload.append(
      'file',
      new File(['林晚重新回到旧厂房，顾承砚在门口等她。'], '主流程原文.txt', {
        type: 'text/plain',
      })
    );

    const saveSourceResponse = await saveSource(
      new NextRequest(`https://app.test/api/projects/${projectId}/source`, {
        method: 'POST',
        body: sourceUpload,
      }),
      { params: Promise.resolve({ projectId }) }
    );
    expect(saveSourceResponse.status).toBe(200);

    const createPipelineResponse = await createPipeline(
      new NextRequest(`https://app.test/api/projects/${projectId}/pipelines`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'novel-to-storyboard',
          payload: {
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
        }),
      }),
      { params: Promise.resolve({ projectId }) }
    );
    expect(createPipelineResponse.status).toBe(200);
    const pipelinePayload = await createPipelineResponse.json();
    expect(pipelinePayload).toMatchObject({
      ok: true,
      pipeline: {
        mode: 'novel-to-storyboard',
        job: {
          id: expect.any(String),
        },
      },
    });
    expect(mocks.scheduledJobIds).toEqual([pipelinePayload.pipeline.job.id]);

    await processPersistedGenerationJob(pipelinePayload.pipeline.job.id);
    expect(mocks.scheduledJobIds).toHaveLength(2);
    await processPersistedGenerationJob(mocks.scheduledJobIds[1]);

    const bundleResponse = await getProjectBundle(
      new Request(`https://app.test/api/projects/${projectId}`),
      { params: Promise.resolve({ projectId }) }
    );
    expect(bundleResponse.status).toBe(200);
    const bundlePayload = await bundleResponse.json();

    const jobs = bundlePayload.jobs as GenerationJob[];
    const artifacts = bundlePayload.artifacts as GenerationArtifact[];
    const relations = bundlePayload.artifactRelations as ArtifactRelation[];
    const scriptJob = jobs.find((job) => job.kind === 'script-generation');
    const storyboardJob = jobs.find((job) => job.kind === 'storyboard-generation');
    const sourceDocument = bundlePayload.sourceDocuments[0];
    const account = await runtime.creditAccounts.getByOrganizationId(organization.id);

    expect(mocks.runScriptGeneration).toHaveBeenCalledTimes(1);
    expect(mocks.runStoryboardGeneration).toHaveBeenCalledTimes(1);
    expect(sourceDocument).toMatchObject({
      title: '主流程原文',
      textContent: '林晚重新回到旧厂房，顾承砚在门口等她。',
    });
    expect(jobs).toHaveLength(2);
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
    expect(artifacts.map((artifact) => artifact.kind).sort()).toEqual([
      'analysis',
      'outline',
      'script',
      'storyboard',
    ]);
    expect(relations).toHaveLength(3);
    expect(
      relations.map((relation) => [relation.upstreamArtifactId, relation.downstreamArtifactId]).length
    ).toBe(3);
    expect(bundlePayload.insights.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'script', count: 1 }),
        expect.objectContaining({ kind: 'storyboard', count: 1 }),
      ])
    );
    expect(account).toMatchObject({
      availableCredits: 47,
      consumedCreditsTotal: 53,
      reservedCredits: 0,
    });
  });

  it('keeps intermediate artifacts, does not start storyboard, and releases credits when script generation fails', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-project-main-flow-fail-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');
    process.env.LLM_API_KEY = 'sk-test';
    delete process.env.REDIS_URL;

    mocks.runScriptGeneration.mockImplementation(async (input: any) => {
      await input.onArtifact?.({
        kind: 'analysis',
        title: '小说分析',
        format: 'application/json',
        content: '{"title":"失败前分析"}',
        metadata: {},
      });
      await input.onArtifact?.({
        kind: 'outline',
        title: '分集大纲',
        format: 'application/json',
        content: '[{"episodeNumber":1,"title":"失败前大纲"}]',
        metadata: {},
      });
      throw new Error('SCRIPT_PROVIDER_FAILED');
    });
    mocks.runStoryboardGeneration.mockImplementation(async () => {
      throw new Error('storyboard should not start');
    });

    vi.resetModules();
    const { getPlatformRuntime } = await import('@/server/shared/platform');
    const { grantCredits } = await import('@/server/billing/service');
    const { processPersistedGenerationJob } = await import('@/server/generation/service');
    const { POST: createProject } = await import('@/app/api/projects/route');
    const { POST: saveSource } = await import('@/app/api/projects/[projectId]/source/route');
    const { POST: createPipeline } = await import('@/app/api/projects/[projectId]/pipelines/route');
    const { GET: getProjectBundle } = await import('@/app/api/projects/[projectId]/route');

    const runtime = getPlatformRuntime();
    const user = await runtime.users.create({
      email: 'route-flow-fail@example.com',
      displayName: 'Route Flow Fail User',
      preferredLocale: 'zh-CN',
      createdByUserId: null,
    });
    const organization = await runtime.organizations.create({
      slug: 'route-flow-fail-org',
      name: 'Route Flow Fail Org',
      ownerUserId: user.id,
      billingLocale: 'zh-CN',
      billingCurrency: 'USD',
      pricingRegion: 'global',
      createdByUserId: user.id,
    });
    const workspace = await runtime.workspaces.create({
      organizationId: organization.id,
      slug: 'route-flow-fail-workspace',
      name: 'Route Flow Fail Workspace',
      defaultLocale: 'zh-CN',
      createdByUserId: user.id,
    });

    mocks.viewer = {
      organization: { id: organization.id },
      workspace: { id: workspace.id },
      user: { id: user.id },
      session: { locale: 'zh-CN' },
    };

    await grantCredits({
      organizationId: organization.id,
      userId: user.id,
      credits: 100,
      kind: 'manual_adjustment',
      note: 'route integration failure test credits',
    });

    const createProjectResponse = await createProject(
      new NextRequest('https://app.test/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Route Flow Failure Project',
          description: 'Route-to-route failure verification',
          genre: 'urban',
        }),
      })
    );
    const createProjectPayload = await createProjectResponse.json();
    const projectId = createProjectPayload.project.id as string;

    await saveSource(
      new NextRequest(`https://app.test/api/projects/${projectId}/source`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: '失败主流程原文',
          textContent: '林晚重新回到旧厂房，顾承砚在门口等她。',
        }),
      }),
      { params: Promise.resolve({ projectId }) }
    );

    const createPipelineResponse = await createPipeline(
      new NextRequest(`https://app.test/api/projects/${projectId}/pipelines`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'novel-to-storyboard',
          payload: {
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
            },
          },
        }),
      }),
      { params: Promise.resolve({ projectId }) }
    );
    expect(createPipelineResponse.status).toBe(200);
    const pipelinePayload = await createPipelineResponse.json();

    await processPersistedGenerationJob(pipelinePayload.pipeline.job.id);
    expect(mocks.scheduledJobIds).toEqual([pipelinePayload.pipeline.job.id]);
    expect(mocks.runStoryboardGeneration).not.toHaveBeenCalled();

    const bundleResponse = await getProjectBundle(
      new Request(`https://app.test/api/projects/${projectId}`),
      { params: Promise.resolve({ projectId }) }
    );
    expect(bundleResponse.status).toBe(200);
    const bundlePayload = await bundleResponse.json();

    const jobs = bundlePayload.jobs as GenerationJob[];
    const artifacts = bundlePayload.artifacts as GenerationArtifact[];
    const relations = bundlePayload.artifactRelations as ArtifactRelation[];
    const account = await runtime.creditAccounts.getByOrganizationId(organization.id);
    const storedProject = await runtime.projects.getById(projectId);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      kind: 'script-generation',
      status: 'failed',
      billingState: 'released',
      errorMessage: 'SCRIPT_PROVIDER_FAILED',
    });
    expect(artifacts.map((artifact) => artifact.kind).sort()).toEqual([
      'analysis',
      'outline',
    ]);
    expect(relations).toHaveLength(0);
    expect(account).toMatchObject({
      availableCredits: 100,
      consumedCreditsTotal: 0,
      reservedCredits: 0,
    });
    expect(storedProject?.latestGenerationJobId).toBe(pipelinePayload.pipeline.job.id);
  });
});

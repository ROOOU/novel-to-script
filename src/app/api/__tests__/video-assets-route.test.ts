import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
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
  generateVideos: vi.fn(),
  getVideosOperation: vi.fn(),
  downloadFile: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: (...args: unknown[]) => mocks.requireViewerResponse(...args),
}));

vi.mock('@/server/generation/queue', () => ({
  getProjectGenerationScheduler: () => mocks.scheduler,
  resetProjectGenerationSchedulerForTests: () => {
    mocks.scheduledJobIds.length = 0;
  },
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateVideos: (...args: unknown[]) => mocks.generateVideos(...args),
    };

    operations = {
      getVideosOperation: (...args: unknown[]) => mocks.getVideosOperation(...args),
    };

    files = {
      download: (...args: unknown[]) => mocks.downloadFile(...args),
    };
  },
  VideoGenerationReferenceType: {
    ASSET: 'ASSET',
  },
}));

describe('video assets and generation flow', () => {
  let previousStorePath: string | undefined;
  let previousMediaDir: string | undefined;
  let previousVideoEnabled: string | undefined;
  let previousGeminiApiKey: string | undefined;
  let previousRedisUrl: string | undefined;
  let previousVideoPollInterval: string | undefined;
  let tempDir: string | null = null;

  beforeEach(() => {
    previousStorePath = process.env.NOVELSCRIPT_STORE_PATH;
    previousMediaDir = process.env.NOVELSCRIPT_MEDIA_DIR;
    previousVideoEnabled = process.env.NOVELSCRIPT_ENABLE_VIDEO_GENERATION;
    previousGeminiApiKey = process.env.GEMINI_API_KEY;
    previousRedisUrl = process.env.REDIS_URL;
    previousVideoPollInterval = process.env.NOVELSCRIPT_VIDEO_POLL_INTERVAL_MS;
    mocks.viewer = null;
    mocks.scheduledJobIds.length = 0;
    mocks.requireViewerResponse.mockReset();
    mocks.scheduler.schedule.mockClear();
    mocks.generateVideos.mockReset();
    mocks.getVideosOperation.mockReset();
    mocks.downloadFile.mockReset();
    mocks.fetch.mockReset();
    vi.stubGlobal('fetch', mocks.fetch);

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
    vi.unstubAllGlobals();

    if (previousStorePath === undefined) {
      delete process.env.NOVELSCRIPT_STORE_PATH;
    } else {
      process.env.NOVELSCRIPT_STORE_PATH = previousStorePath;
    }

    if (previousMediaDir === undefined) {
      delete process.env.NOVELSCRIPT_MEDIA_DIR;
    } else {
      process.env.NOVELSCRIPT_MEDIA_DIR = previousMediaDir;
    }

    if (previousVideoEnabled === undefined) {
      delete process.env.NOVELSCRIPT_ENABLE_VIDEO_GENERATION;
    } else {
      process.env.NOVELSCRIPT_ENABLE_VIDEO_GENERATION = previousVideoEnabled;
    }

    if (previousGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousGeminiApiKey;
    }

    if (previousRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousRedisUrl;
    }

    if (previousVideoPollInterval === undefined) {
      delete process.env.NOVELSCRIPT_VIDEO_POLL_INTERVAL_MS;
    } else {
      process.env.NOVELSCRIPT_VIDEO_POLL_INTERVAL_MS = previousVideoPollInterval;
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('uploads image assets through the project assets route', async () => {
    const setup = await setupProjectEnvironment();
    const { POST: uploadAsset } = await import('@/app/api/projects/[projectId]/assets/route');

    const formData = new FormData();
    formData.append(
      'file',
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'reference.png', {
        type: 'image/png',
      })
    );

    const response = await uploadAsset(
      new NextRequest(`https://app.test/api/projects/${setup.project.id}/assets`, {
        method: 'POST',
        body: formData,
      }),
      { params: Promise.resolve({ projectId: setup.project.id }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.artifact.kind).toBe('reference_image');
    expect(payload.artifact.storageKey).toContain('images/');

    const invalidFormData = new FormData();
    invalidFormData.append(
      'file',
      new File(['not-an-image'], 'note.txt', { type: 'text/plain' })
    );

    const invalidResponse = await uploadAsset(
      new NextRequest(`https://app.test/api/projects/${setup.project.id}/assets`, {
        method: 'POST',
        body: invalidFormData,
      }),
      { params: Promise.resolve({ projectId: setup.project.id }) }
    );

    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({
      ok: false,
      error: 'ASSET_FILE_TYPE_INVALID',
    });
  });

  it('rejects invalid video-generation payloads before the job is created', async () => {
    const setup = await setupProjectEnvironment();
    const { getPlatformRuntime } = await import('@/server/shared/platform');
    const actualRuntime = getPlatformRuntime();

    await actualRuntime.generationArtifacts.create({
      organizationId: setup.organization.id,
      workspaceId: setup.workspace.id,
      projectId: setup.project.id,
      generationJobId: 'job_shot_plan',
      kind: 'shot_plan',
      format: 'application/json',
      title: '镜头计划',
      content: JSON.stringify([
        {
          sceneId: 'S01',
          shotId: 'S01-SH01',
          shotType: '中景',
          camera: '固定机位',
          composition: '居中',
          motion: '缓慢推进',
          subject: '主角',
          environment: '室内',
          lighting: '自然光',
          audioHint: '环境音',
          videoPrompt: '主角在室内缓慢推进',
        },
      ]),
      createdByUserId: setup.user.id,
    });

    const { POST: createJob } = await import('@/app/api/projects/[projectId]/jobs/route');
    const response = await createJob(
      new NextRequest(`https://app.test/api/projects/${setup.project.id}/jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'video-generation',
          payload: {
            shotPlanArtifactId: (await actualRuntime.generationArtifacts.getLatestByKind(setup.project.id, 'shot_plan'))?.id,
            shotId: 'S01-SH01',
            lastFrameArtifactId: 'artifact_missing',
          },
        }),
      }),
      { params: Promise.resolve({ projectId: setup.project.id }) }
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('video payload requires both firstFrameArtifactId and lastFrameArtifactId');
  });

  it('creates, processes, and downloads generated video artifacts', async () => {
    const setup = await setupProjectEnvironment();
    const platform = await import('@/server/shared/platform');
    const runtime = platform.getPlatformRuntime();
    const { POST: uploadAsset } = await import('@/app/api/projects/[projectId]/assets/route');
    const { POST: createJob } = await import('@/app/api/projects/[projectId]/jobs/route');
    const { GET: downloadArtifact } = await import('@/app/api/artifacts/[artifactId]/download/route');
    const { processPersistedGenerationJob } = await import('@/server/generation/service');
    const { getProjectBundle } = await import('@/server/projects/service');

    const shotPlanArtifact = await runtime.generationArtifacts.create({
      organizationId: setup.organization.id,
      workspaceId: setup.workspace.id,
      projectId: setup.project.id,
      generationJobId: 'job_shot_plan',
      kind: 'shot_plan',
      format: 'application/json',
      title: '镜头计划',
      content: JSON.stringify([
        {
          sceneId: 'S01',
          shotId: 'S01-SH01',
          shotType: '中景',
          camera: '固定机位',
          composition: '居中',
          motion: '缓慢推进',
          subject: '主角',
          environment: '夜景街头',
          lighting: '霓虹光',
          audioHint: '城市环境声',
          videoPrompt: '夜景街头，中景，缓慢推进，主角站在霓虹灯下观察四周',
        },
      ]),
      createdByUserId: setup.user.id,
    });

    const imageUpload = new FormData();
    imageUpload.append(
      'file',
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'hero-reference.png', {
        type: 'image/png',
      })
    );
    const imageUploadResponse = await uploadAsset(
      new NextRequest(`https://app.test/api/projects/${setup.project.id}/assets`, {
        method: 'POST',
        body: imageUpload,
      }),
      { params: Promise.resolve({ projectId: setup.project.id }) }
    );
    const imageUploadPayload = await imageUploadResponse.json();
    const imageArtifactId = imageUploadPayload.artifact.id as string;

    const operation = {
      name: 'operations/video-op-001',
      done: false,
    };
    mocks.generateVideos.mockResolvedValue(operation);
    mocks.getVideosOperation.mockResolvedValue({
      ...operation,
      done: true,
      response: {
        generatedVideos: [
          {
            video: {
              uri: 'https://example.test/generated-video.mp4',
              mimeType: 'video/mp4',
            },
          },
        ],
      },
    });
    mocks.downloadFile.mockImplementation(async ({ downloadPath }: { downloadPath: string }) => {
      await writeFile(downloadPath, new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]));
    });

    const createJobResponse = await createJob(
      new NextRequest(`https://app.test/api/projects/${setup.project.id}/jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'video-generation',
          payload: {
            shotPlanArtifactId: shotPlanArtifact.id,
            shotId: 'S01-SH01',
            referenceImageArtifactIds: [imageArtifactId],
            firstFrameArtifactId: imageArtifactId,
            lastFrameArtifactId: imageArtifactId,
            aspectRatio: '9:16',
          },
        }),
      }),
      { params: Promise.resolve({ projectId: setup.project.id }) }
    );

    expect(createJobResponse.status).toBe(200);
    const createJobPayload = await createJobResponse.json();
    expect(createJobPayload.ok).toBe(true);

    await processPersistedGenerationJob(createJobPayload.job.id);

    const bundle = await getProjectBundle(setup.project.id);
    const videoArtifact = bundle?.artifacts.find((artifact) => artifact.kind === 'video_clip');
    expect(videoArtifact).toBeTruthy();
    expect(videoArtifact?.metadata).toMatchObject({
      provider: 'gemini',
      model: 'veo-3.1-generate-preview',
      sourceShotId: 'S01-SH01',
      sourceShotPlanArtifactId: shotPlanArtifact.id,
      referenceImageArtifactIds: [imageArtifactId],
      firstFrameArtifactId: imageArtifactId,
      lastFrameArtifactId: imageArtifactId,
      providerOperationName: 'operations/video-op-001',
    });
    expect(mocks.downloadFile).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).not.toHaveBeenCalled();

    const downloadResponse = await downloadArtifact(new Request('https://app.test/download'), {
      params: Promise.resolve({ artifactId: videoArtifact?.id ?? '' }),
    });
    expect(downloadResponse.headers.get('content-type')).toBe('video/mp4');
    expect(Buffer.from(await downloadResponse.arrayBuffer())).toHaveLength(8);
  });

  async function setupProjectEnvironment() {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-video-flow-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');
    process.env.NOVELSCRIPT_MEDIA_DIR = path.join(tempDir, 'media');
    process.env.NOVELSCRIPT_ENABLE_VIDEO_GENERATION = 'true';
    process.env.GEMINI_API_KEY = 'gem-test-key';
    process.env.NOVELSCRIPT_VIDEO_POLL_INTERVAL_MS = '1';
    delete process.env.REDIS_URL;

    vi.resetModules();

    const { getPlatformRuntime } = await import('@/server/shared/platform');
    const runtime = getPlatformRuntime();
    const user = await runtime.users.create({
      email: 'video-flow@example.com',
      displayName: 'Video Flow User',
      preferredLocale: 'zh-CN',
      createdByUserId: null,
    });
    const organization = await runtime.organizations.create({
      slug: 'video-flow-org',
      name: 'Video Flow Org',
      ownerUserId: user.id,
      billingLocale: 'zh-CN',
      billingCurrency: 'USD',
      pricingRegion: 'global',
      createdByUserId: user.id,
    });
    const workspace = await runtime.workspaces.create({
      organizationId: organization.id,
      slug: 'video-flow-workspace',
      name: 'Video Flow Workspace',
      defaultLocale: 'zh-CN',
      createdByUserId: user.id,
    });
    const project = await runtime.projects.create({
      organizationId: organization.id,
      workspaceId: workspace.id,
      slug: 'video-flow-project',
      name: 'Video Flow Project',
      createdByUserId: user.id,
    });

    mocks.viewer = {
      organization: { id: organization.id },
      workspace: { id: workspace.id },
      user: { id: user.id },
      session: { locale: 'zh-CN' },
    };

    return { runtime, user, organization, workspace, project };
  }
});

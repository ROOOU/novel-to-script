import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatformRuntime: vi.fn(),
  createProjectGenerationJob: vi.fn(),
  releaseJobCredits: vi.fn(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

vi.mock('@/server/generation/service', () => ({
  createProjectGenerationJob: (...args: unknown[]) => mocks.createProjectGenerationJob(...args),
}));

vi.mock('@/server/billing/service', () => ({
  releaseJobCredits: (...args: unknown[]) => mocks.releaseJobCredits(...args),
}));

import { cancelProjectGenerationJob, retryProjectGenerationJob } from '@/server/projects/job-actions';

describe('project job actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformRuntime.mockReturnValue({
      generationJobs: {
        getById: vi.fn(),
        cancel: vi.fn(),
        update: vi.fn(),
      },
    });
  });

  it('retries failed storyboard jobs using the original snapshot payload', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationJobs.getById.mockResolvedValue({
      id: 'job_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      kind: 'storyboard-generation',
      status: 'failed',
      billingState: 'released',
      reservedCredits: 18,
      progress: 100,
      inputSnapshot: {
        payload: {
          scriptText: '',
          scriptArtifactIds: ['script_1'],
          visualStyle: 'cinematic',
          colorTone: 'warm',
        },
        metadata: {
          pipelineMode: 'novel-to-storyboard',
          storyboardPayload: { visualStyle: 'cinematic' },
        },
      },
    });
    mocks.createProjectGenerationJob.mockResolvedValue({
      id: 'job_2',
      kind: 'storyboard-generation',
    });

    const result = await retryProjectGenerationJob({
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      userId: 'user_1',
      jobId: 'job_1',
    });

    expect(mocks.createProjectGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        kind: 'storyboard-generation',
        body: expect.objectContaining({
          scriptArtifactIds: ['script_1'],
          visualStyle: 'cinematic',
        }),
        metadata: expect.objectContaining({
          pipelineMode: 'novel-to-storyboard',
          retriedFromJobId: 'job_1',
          retriedFromJobKind: 'storyboard-generation',
          retriedFromJobStatus: 'failed',
        }),
      })
    );
    expect(result).toMatchObject({
      action: 'retry',
      originalJob: { id: 'job_1' },
      job: { id: 'job_2' },
    });
  });

  it('cancels a running job and releases reserved credits', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationJobs.getById.mockResolvedValue({
      id: 'job_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      kind: 'script-generation',
      status: 'running',
      billingState: 'reserved',
      reservedCredits: 12,
      progress: 42,
      inputSnapshot: {
        payload: { text: 'novel text', genre: 'urban', config: { episodeCount: 3 } },
        metadata: {},
      },
    });
    runtime.generationJobs.cancel.mockResolvedValue({
      id: 'job_1',
      status: 'cancelled',
      billingState: 'reserved',
      reservedCredits: 12,
    });
    runtime.generationJobs.update.mockResolvedValue({
      id: 'job_1',
      status: 'cancelled',
      billingState: 'released',
      reservedCredits: 12,
    });

    const result = await cancelProjectGenerationJob({
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      userId: 'user_1',
      jobId: 'job_1',
    });

    expect(runtime.generationJobs.cancel).toHaveBeenCalledWith('job_1', expect.any(String), 'user_1');
    expect(mocks.releaseJobCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'user_1',
        generationJobId: 'job_1',
        credits: 12,
      })
    );
    expect(runtime.generationJobs.update).toHaveBeenCalledWith(
      'job_1',
      expect.objectContaining({
        billingState: 'released',
        updatedByUserId: 'user_1',
      })
    );
    expect(result).toMatchObject({
      action: 'cancel',
      job: {
        id: 'job_1',
        billingState: 'released',
      },
    });
  });
});

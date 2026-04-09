import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createProjectGenerationJob: vi.fn(),
}));

vi.mock('@/server/generation/service', () => ({
  createProjectGenerationJob: (...args: unknown[]) => mocks.createProjectGenerationJob(...args),
}));

import { createNovelToStoryboardPipeline } from '@/server/generation/pipeline-service';

describe('createNovelToStoryboardPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a script job with pipeline metadata and storyboard payload', async () => {
    mocks.createProjectGenerationJob.mockResolvedValue({
      id: 'job_script_1',
      kind: 'script-generation',
    });

    const result = await createNovelToStoryboardPipeline({
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      userId: 'user_1',
      body: {
        text: '原文内容',
        genre: 'urban',
        config: {
          genre: 'urban',
          episodeCount: 6,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
        storyboardConfig: {
          visualStyle: 'cinematic',
          colorTone: 'warm',
          genreLabel: 'urban',
          safeMode: true,
        },
      },
    });

    expect(mocks.createProjectGenerationJob).toHaveBeenCalledWith({
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      userId: 'user_1',
      kind: 'script-generation',
      body: {
        text: '原文内容',
        genre: 'urban',
        config: {
          genre: 'urban',
          episodeCount: 6,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
        analysis: undefined,
      },
      metadata: {
        pipelineMode: 'novel-to-storyboard',
        storyboardPayload: {
          visualStyle: 'cinematic',
          colorTone: 'warm',
          genreLabel: 'urban',
          safeMode: true,
        },
      },
    });
    expect(result).toEqual({
      mode: 'novel-to-storyboard',
      job: {
        id: 'job_script_1',
        kind: 'script-generation',
      },
    });
  });

  it('falls back to an empty storyboard payload when config is omitted', async () => {
    mocks.createProjectGenerationJob.mockResolvedValue({
      id: 'job_script_2',
      kind: 'script-generation',
    });

    await createNovelToStoryboardPipeline({
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      userId: 'user_1',
      body: {
        text: '原文内容',
        genre: 'fantasy',
        config: {
          genre: 'fantasy',
          episodeCount: 3,
          episodeDuration: '2:00-3:00',
          style: 'suspense',
          includeDirectorNotes: false,
        },
      },
    });

    expect(mocks.createProjectGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          pipelineMode: 'novel-to-storyboard',
          storyboardPayload: {},
        },
      })
    );
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getStoryboardRequestError,
  resolveStoryboardScriptSource,
  runStoryboardGeneration,
} from '@/server/storyboard/application/run-storyboard-generation';

const streamLLM = vi.fn();
const getPlatformRuntime = vi.fn();

vi.mock('@/lib/llm', () => ({
  streamLLM: (...args: unknown[]) => streamLLM(...args),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => getPlatformRuntime(),
}));

describe('storyboard generation request handling', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accepts storyboard requests that only reference source script artifacts', () => {
    expect(
      getStoryboardRequestError({
        scriptArtifactIds: ['script_1'],
        visualStyle: 'cinematic',
      })
    ).toBeNull();
  });

  it('prefers source artifacts over fallback script text and records their ids', async () => {
    const getById = vi.fn(async (id: string) => {
      if (id === 'script_1') {
        return {
          id: 'script_1',
          kind: 'script',
          content: '1-1 日 内 客厅\n阿明：来自工件',
        };
      }

      return null;
    });

    getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById,
      },
    });

    let capturedUserPrompt = '';
    streamLLM.mockImplementation(async function* (_systemPrompt: string, userPrompt: string) {
      capturedUserPrompt = userPrompt;
      yield '分镜内容';
    });

    const onArtifact = vi.fn();

    await runStoryboardGeneration({
      body: {
        scriptText: 'fallback script text',
        scriptArtifactIds: ['script_1'],
        visualStyle: 'cinematic realism',
        colorTone: 'warm tone',
        genreLabel: '都市女频',
        safeMode: false,
      },
      context: {
        requestId: 'req_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        plan: 'free',
      } as never,
      jobId: 'job_1',
      send: vi.fn(),
      llmConfig: {} as never,
      onArtifact,
    });

    expect(getById).toHaveBeenCalledWith('script_1');
    expect(capturedUserPrompt).toContain('来自工件');
    expect(capturedUserPrompt).not.toContain('fallback script text');
    expect(onArtifact).toHaveBeenCalledTimes(1);
    expect(onArtifact.mock.calls[0][0].metadata).toMatchObject({
      sourceScriptArtifactIds: ['script_1'],
    });
  });

  it('resolves storyboard script text from a script artifact list helper', async () => {
    getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById: vi.fn(async () => ({
          id: 'script_1',
          kind: 'script',
          content: 'A',
        })),
      },
    });

    await expect(
      resolveStoryboardScriptSource({
        scriptText: 'fallback',
        scriptArtifactIds: ['script_1'],
      })
    ).resolves.toMatchObject({
      scriptText: 'A',
      sourceScriptArtifactIds: ['script_1'],
    });
  });
});

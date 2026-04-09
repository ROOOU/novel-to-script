import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  constructorArgs: [] as Array<{ apiKey: string; baseURL: string; timeout: number }>,
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor(config: { apiKey: string; baseURL: string; timeout: number }) {
      mocks.constructorArgs.push(config);
    }

    chat = {
      completions: {
        create: mocks.createCompletion,
      },
    };
  },
}));

import { analyzeNovel, callLLM, streamLLM } from '@/lib/llm';

describe('llm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.constructorArgs.length = 0;
  });

  it('reduces max_tokens automatically for long prompts', async () => {
    mocks.createCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'ok',
          },
        },
      ],
    });

    const result = await callLLM('system', '字'.repeat(18_500), {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4o',
    });

    expect(result).toBe('ok');
    expect(mocks.createCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 2048,
      })
    );
  });

  it('retries analysis with a smaller input window after provider 400 errors', async () => {
    mocks.createCompletion
      .mockRejectedValueOnce(Object.assign(new Error('400 status code (no body)'), { status: 400 }))
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"title":"ok","characters":[],"plotSummary":"","keyConflicts":[],"climaxPoints":[],"emotionalBeats":[]}',
            },
          },
        ],
      });

    const result = await analyzeNovel('字'.repeat(10_000), 'urban', {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'glm-5',
    });

    expect(result).toContain('"title":"ok"');
    expect(mocks.createCompletion).toHaveBeenCalledTimes(2);

    const firstUserMessage = mocks.createCompletion.mock.calls[0][0].messages[1].content as string;
    const secondUserMessage = mocks.createCompletion.mock.calls[1][0].messages[1].content as string;

    expect(secondUserMessage.length).toBeLessThan(firstUserMessage.length);
  });

  it('does not wrap normalized LLM errors repeatedly', async () => {
    const normalizedError = Object.assign(
      new Error('LLM 请求被上游拒绝（403）。当前模型 glm-5，接口 https://example.com。'),
      { status: 403 }
    );

    mocks.createCompletion.mockRejectedValue(normalizedError);

    await expect(
      analyzeNovel('短文本', 'urban', {
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'glm-5',
      })
    ).rejects.toThrow('LLM 请求被上游拒绝（403）。当前模型 glm-5，接口 https://example.com。');
  });

  it('enables json mode for gemini models behind OpenAI-compatible gateways', async () => {
    mocks.createCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"title":"ok"}',
          },
        },
      ],
    });

    await callLLM('system', '请输出 json', {
      apiKey: 'test-key',
      baseUrl: 'https://newapi.example.com/v1',
      modelName: 'gemini-2.5-flash',
    }, {
      responseFormat: 'json_object',
    });

    expect(mocks.createCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: 'json_object' },
      })
    );
  });

  it('falls back to the next provider when the primary provider is deactivated', async () => {
    mocks.createCompletion
      .mockRejectedValueOnce(
        Object.assign(
          new Error('401 Your OpenAI account has been deactivated'),
          { status: 401 }
        )
      )
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'fallback-ok',
            },
          },
        ],
      });

    const result = await callLLM('system', 'hello', {
      apiKey: 'primary-key',
      baseUrl: 'https://primary.example.com/v1',
      modelName: 'gpt-5.4',
      fallbacks: [
        {
          apiKey: 'backup-key',
          baseUrl: 'https://backup.example.com/v1',
          modelName: 'gemini-2.5-flash',
          label: 'backup',
        },
      ],
    });

    expect(result).toBe('fallback-ok');
    expect(mocks.createCompletion).toHaveBeenCalledTimes(2);
    expect(mocks.constructorArgs).toEqual([
      expect.objectContaining({
        apiKey: 'primary-key',
        baseURL: 'https://primary.example.com/v1',
      }),
      expect.objectContaining({
        apiKey: 'backup-key',
        baseURL: 'https://backup.example.com/v1',
      }),
    ]);
  });

  it('fails a stalled streaming request instead of hanging forever', async () => {
    vi.useFakeTimers();
    mocks.createCompletion.mockImplementation(
      (_body, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        })
    );

    try {
      const consumePromise = streamLLM('system', 'stream please', {
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'glm-5',
        timeoutMs: 50,
      }).next().then(
        (value) => ({ value }),
        (error) => ({ error })
      );

      await vi.advanceTimersByTimeAsync(60);

      const result = await consumePromise;
      expect(result).toHaveProperty('error');
      expect((result as { error: Error }).error.message).toContain('LLM 流式调用超时');
    } finally {
      vi.useRealTimers();
    }
  });
});

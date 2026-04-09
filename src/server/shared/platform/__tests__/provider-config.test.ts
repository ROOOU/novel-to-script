import { afterEach, describe, expect, it } from 'vitest';
import { resolvePlatformLLMConfig } from '@/server/shared/platform/provider-config';

const ORIGINAL_ENV = {
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_MODEL_NAME: process.env.LLM_MODEL_NAME,
  LLM_FALLBACKS: process.env.LLM_FALLBACKS,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('resolvePlatformLLMConfig', () => {
  const context = {
    requestId: 'req_1',
    traceId: 'trace_1',
    clientIp: '127.0.0.1',
    userAgent: 'vitest',
    referer: null,
    locale: 'zh-CN',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    userId: 'user_1',
    sessionId: 'sess_1',
    plan: 'creator' as const,
    source: 'default' as const,
  };

  it('returns fallback-only config when primary key is absent', () => {
    delete process.env.LLM_API_KEY;
    process.env.LLM_BASE_URL = 'https://primary.example.com';
    process.env.LLM_MODEL_NAME = 'gpt-5.4';
    process.env.LLM_FALLBACKS = JSON.stringify([
      {
        apiKey: 'backup-key',
        baseUrl: 'https://backup.example.com',
        modelName: 'gemini-2.5-flash',
      },
    ]);

    const result = resolvePlatformLLMConfig(context);

    expect(result.error).toBeNull();
    expect(result.config).toEqual(
      expect.objectContaining({
        apiKey: '',
        baseUrl: 'https://primary.example.com/v1',
        modelName: 'gpt-5.4',
        fallbacks: [
          expect.objectContaining({
            apiKey: 'backup-key',
            baseUrl: 'https://backup.example.com/v1',
            modelName: 'gemini-2.5-flash',
          }),
        ],
      })
    );
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { getServerLLMConfigError, hasServerLLMApiKey } from '@/lib/server-llm-config';

const ORIGINAL_LLM_API_KEY = process.env.LLM_API_KEY;
const ORIGINAL_LLM_FALLBACKS = process.env.LLM_FALLBACKS;

afterEach(() => {
  if (ORIGINAL_LLM_API_KEY === undefined) {
    delete process.env.LLM_API_KEY;
  } else {
    process.env.LLM_API_KEY = ORIGINAL_LLM_API_KEY;
  }

  if (ORIGINAL_LLM_FALLBACKS === undefined) {
    delete process.env.LLM_FALLBACKS;
  } else {
    process.env.LLM_FALLBACKS = ORIGINAL_LLM_FALLBACKS;
  }
});

describe('server-llm-config', () => {
  it('reports missing configuration when no api key env is present', () => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_FALLBACKS;

    expect(hasServerLLMApiKey()).toBe(false);
    expect(getServerLLMConfigError()).toContain('LLM Provider');
  });

  it('accepts LLM_API_KEY as the primary env name', () => {
    process.env.LLM_API_KEY = 'sk-test';
    delete process.env.LLM_FALLBACKS;

    expect(hasServerLLMApiKey()).toBe(true);
    expect(getServerLLMConfigError()).toBeNull();
  });

  it('accepts fallback providers even when the primary api key is absent', () => {
    delete process.env.LLM_API_KEY;
    process.env.LLM_FALLBACKS = JSON.stringify([{ apiKey: 'sk-backup' }]);

    expect(hasServerLLMApiKey()).toBe(true);
    expect(getServerLLMConfigError()).toBeNull();
  });
});

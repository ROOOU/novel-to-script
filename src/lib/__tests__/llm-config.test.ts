import { describe, expect, it } from 'vitest';
import {
  getMinimumStaleGenerationRecoveryWindowMs,
  normalizeLLMBaseUrl,
  parseLLMFallbackConfigsFromEnv,
  resolveStaleGenerationRecoveryWindowMs,
} from '@/lib/llm-config';

describe('normalizeLLMBaseUrl', () => {
  it('uses the default OpenAI base url when value is empty', () => {
    expect(normalizeLLMBaseUrl('')).toBe('https://api.openai.com/v1');
    expect(normalizeLLMBaseUrl(undefined)).toBe('https://api.openai.com/v1');
  });

  it('appends /v1 when provider root url is used', () => {
    expect(normalizeLLMBaseUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/v1');
    expect(normalizeLLMBaseUrl('https://openrouter.ai/api')).toBe('https://openrouter.ai/api/v1');
    expect(normalizeLLMBaseUrl('https://llm.example.com')).toBe('https://llm.example.com/v1');
  });

  it('keeps versioned api root urls unchanged', () => {
    expect(normalizeLLMBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    expect(normalizeLLMBaseUrl('https://openrouter.ai/api/v1/')).toBe('https://openrouter.ai/api/v1');
    expect(normalizeLLMBaseUrl('https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints'))
      .toBe('https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints');
  });

  it('strips known endpoint suffixes back to the api root', () => {
    expect(normalizeLLMBaseUrl('https://api.openai.com/v1/chat/completions')).toBe('https://api.openai.com/v1');
    expect(normalizeLLMBaseUrl('https://api.openai.com/v1/responses')).toBe('https://api.openai.com/v1');
  });

  it('uses a stale recovery window that is longer than the llm retry budget', () => {
    const minimumWindow = getMinimumStaleGenerationRecoveryWindowMs();

    expect(minimumWindow).toBeGreaterThan(120_000);
    expect(resolveStaleGenerationRecoveryWindowMs(undefined)).toBe(minimumWindow);
    expect(resolveStaleGenerationRecoveryWindowMs('90000')).toBe(minimumWindow);
  });

  it('preserves explicitly larger stale recovery windows', () => {
    const minimumWindow = getMinimumStaleGenerationRecoveryWindowMs();

    expect(resolveStaleGenerationRecoveryWindowMs(minimumWindow + 60_000)).toBe(minimumWindow + 60_000);
    expect(resolveStaleGenerationRecoveryWindowMs(String(minimumWindow + 60_000))).toBe(minimumWindow + 60_000);
  });
});

describe('parseLLMFallbackConfigsFromEnv', () => {
  it('parses fallback provider json and normalizes base urls', () => {
    const fallbacks = parseLLMFallbackConfigsFromEnv({
      LLM_FALLBACKS: JSON.stringify([
        {
          apiKey: 'backup-key',
          baseUrl: 'https://backup.example.com',
          modelName: 'gemini-2.5-flash',
          timeoutMs: 45_000,
          label: 'backup-a',
        },
      ]),
    } as NodeJS.ProcessEnv);

    expect(fallbacks).toEqual([
      {
        apiKey: 'backup-key',
        baseUrl: 'https://backup.example.com/v1',
        modelName: 'gemini-2.5-flash',
        timeoutMs: 45_000,
        label: 'backup-a',
      },
    ]);
  });
});

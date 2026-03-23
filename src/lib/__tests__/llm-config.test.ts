import { describe, expect, it } from 'vitest';
import { normalizeOpenAIBaseUrl } from '@/lib/llm-config';

describe('normalizeOpenAIBaseUrl', () => {
  it('uses the default OpenAI base url when value is empty', () => {
    expect(normalizeOpenAIBaseUrl('')).toBe('https://api.openai.com/v1');
    expect(normalizeOpenAIBaseUrl(undefined)).toBe('https://api.openai.com/v1');
  });

  it('appends /v1 when provider root url is used', () => {
    expect(normalizeOpenAIBaseUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/v1');
    expect(normalizeOpenAIBaseUrl('https://openrouter.ai/api')).toBe('https://openrouter.ai/api/v1');
  });

  it('keeps versioned api root urls unchanged', () => {
    expect(normalizeOpenAIBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    expect(normalizeOpenAIBaseUrl('https://openrouter.ai/api/v1/')).toBe('https://openrouter.ai/api/v1');
  });

  it('strips known endpoint suffixes back to the api root', () => {
    expect(normalizeOpenAIBaseUrl('https://api.openai.com/v1/chat/completions')).toBe('https://api.openai.com/v1');
    expect(normalizeOpenAIBaseUrl('https://api.openai.com/v1/responses')).toBe('https://api.openai.com/v1');
  });
});

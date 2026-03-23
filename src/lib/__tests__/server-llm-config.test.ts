import { afterEach, describe, expect, it } from 'vitest';
import { getServerLLMConfigError, hasServerLLMApiKey } from '@/lib/server-llm-config';

const ORIGINAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_API_KEY = process.env.API_KEY;

afterEach(() => {
  if (ORIGINAL_OPENAI_API_KEY === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_API_KEY;
  }

  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = ORIGINAL_API_KEY;
  }
});

describe('server-llm-config', () => {
  it('reports missing configuration when no api key env is present', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.API_KEY;

    expect(hasServerLLMApiKey()).toBe(false);
    expect(getServerLLMConfigError()).toContain('OPENAI_API_KEY');
  });

  it('accepts OPENAI_API_KEY', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.API_KEY;

    expect(hasServerLLMApiKey()).toBe(true);
    expect(getServerLLMConfigError()).toBeNull();
  });

  it('accepts API_KEY as fallback', () => {
    delete process.env.OPENAI_API_KEY;
    process.env.API_KEY = 'sk-test';

    expect(hasServerLLMApiKey()).toBe(true);
    expect(getServerLLMConfigError()).toBeNull();
  });
});

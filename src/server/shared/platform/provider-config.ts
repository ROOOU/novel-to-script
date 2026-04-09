import type { LLMConfig } from '@/lib/llm';
import { normalizeLLMBaseUrl, parseLLMFallbackConfigsFromEnv } from '@/lib/llm-config';
import { type PlatformRequestContext } from './context';

export interface ResolvedPlatformLLMConfig {
  config: LLMConfig | null;
  error: string | null;
  source: 'environment' | 'workspace' | 'plan-default' | 'missing';
}

export interface ResolvePlatformLLMConfigOptions {
  workspaceModelName?: string | null;
  workspaceBaseUrl?: string | null;
  workspaceApiKey?: string | null;
}

const MISSING_LLM_CONFIG_ERROR =
  '服务端未配置可用的 LLM Provider，请设置 LLM_API_KEY 或 LLM_FALLBACKS。';

export function resolvePlatformLLMConfig(
  context: PlatformRequestContext,
  options: ResolvePlatformLLMConfigOptions = {}
): ResolvedPlatformLLMConfig {
  const workspaceApiKey = options.workspaceApiKey?.trim();
  const environmentApiKey = process.env.LLM_API_KEY?.trim() || '';
  const fallbackConfigs = parseLLMFallbackConfigsFromEnv();

  if (workspaceApiKey) {
    return {
      config: {
        apiKey: workspaceApiKey,
        baseUrl: normalizeLLMBaseUrl(options.workspaceBaseUrl?.trim() || process.env.LLM_BASE_URL),
        modelName: options.workspaceModelName?.trim() || getPlanDefaultModel(context),
        fallbacks: fallbackConfigs,
      },
      error: null,
      source: 'workspace',
    };
  }

  if (environmentApiKey || fallbackConfigs.length > 0) {
    return {
      config: {
        apiKey: environmentApiKey,
        baseUrl: normalizeLLMBaseUrl(process.env.LLM_BASE_URL),
        modelName: process.env.LLM_MODEL_NAME || getPlanDefaultModel(context),
        fallbacks: fallbackConfigs,
      },
      error: null,
      source: environmentApiKey ? 'environment' : 'plan-default',
    };
  }

  return {
    config: null,
    error: MISSING_LLM_CONFIG_ERROR,
    source: 'missing',
  };
}

function getPlanDefaultModel(context: PlatformRequestContext): string {
  switch (context.plan) {
    case 'creator':
    case 'pro':
      return 'gemini-2.5-flash';
    case 'free':
    default:
      return 'gemini-2.5-flash';
  }
}

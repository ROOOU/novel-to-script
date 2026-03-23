import type { LLMConfig } from '@/lib/llm';
import { normalizeOpenAIBaseUrl } from '@/lib/llm-config';
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
  '服务端未配置 LLM API Key，请在后端环境变量中设置 OPENAI_API_KEY 或 API_KEY。';

export function resolvePlatformLLMConfig(
  context: PlatformRequestContext,
  options: ResolvePlatformLLMConfigOptions = {}
): ResolvedPlatformLLMConfig {
  const workspaceApiKey = options.workspaceApiKey?.trim();
  const environmentApiKey = process.env.OPENAI_API_KEY?.trim() || process.env.API_KEY?.trim() || '';

  if (workspaceApiKey) {
    return {
      config: {
        apiKey: workspaceApiKey,
        baseUrl: normalizeOpenAIBaseUrl(
          options.workspaceBaseUrl?.trim() || process.env.OPENAI_BASE_URL || process.env.API_BASE_URL
        ),
        modelName: options.workspaceModelName?.trim() || getPlanDefaultModel(context),
      },
      error: null,
      source: 'workspace',
    };
  }

  if (environmentApiKey) {
    return {
      config: {
        apiKey: environmentApiKey,
        baseUrl: normalizeOpenAIBaseUrl(process.env.OPENAI_BASE_URL || process.env.API_BASE_URL),
        modelName: process.env.MODEL_NAME || getPlanDefaultModel(context),
      },
      error: null,
      source: 'environment',
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
    case 'enterprise':
    case 'team':
    case 'pro':
      return 'gpt-4o';
    case 'free':
    default:
      return 'gpt-4o';
  }
}

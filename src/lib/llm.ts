import OpenAI from 'openai';
import { normalizeOpenAIBaseUrl } from '@/lib/llm-config';
import { delay } from '@/lib/timing';
import { GenerateConfig, Genre } from '@/lib/types';
import { getAnalysisPrompt, getOutlinePrompt, getScriptPrompt } from '@/lib/prompts/index';

/**
 * LLM 服务层
 * 封装对 OpenAI-compatible API 的调用（支持 Claude / GPT / DeepSeek 等）
 */

export interface LLMConfig {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  timeoutMs?: number;
}

export interface CallLLMOptions {
  responseFormat?: 'text' | 'json_object';
  maxTokens?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 4096;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

function getResolvedApiKey(config?: LLMConfig) {
  return config?.apiKey || process.env.OPENAI_API_KEY || process.env.API_KEY || '';
}

function getResolvedBaseUrl(config?: LLMConfig) {
  return normalizeOpenAIBaseUrl(config?.baseUrl || process.env.OPENAI_BASE_URL || process.env.API_BASE_URL);
}

function getClient(config?: LLMConfig) {
  const apiKey = getResolvedApiKey(config);
  const baseURL = getResolvedBaseUrl(config);

  return new OpenAI({
    apiKey,
    baseURL,
    timeout: config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}

function getModel(config?: LLMConfig) {
  return config?.modelName || process.env.MODEL_NAME || 'gpt-4o';
}

function supportsJsonResponseFormat(modelName: string): boolean {
  const model = modelName.toLowerCase();
  return model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
}

function estimateDynamicMaxTokens(systemPrompt: string, userMessage: string, fallback: number = DEFAULT_MAX_TOKENS) {
  const promptLength = systemPrompt.length + userMessage.length;

  if (promptLength >= 18_000) return 2_048;
  if (promptLength >= 12_000) return 3_072;
  if (promptLength >= 8_000) return 3_584;
  return fallback;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = Reflect.get(error, 'status');
  return typeof status === 'number' ? status : undefined;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('timeout') || message.includes('timed out') || message.includes('aborted');
}

function shouldRetryLLMError(error: unknown): boolean {
  if (isTimeoutError(error)) return true;

  const status = getErrorStatus(error);
  if (typeof status === 'number') {
    return status >= 500;
  }

  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('network') || message.includes('fetch failed') || message.includes('econnreset');
}

function normalizeLLMError(error: unknown, config?: LLMConfig): Error {
  if (isTimeoutError(error)) {
    return new Error(`LLM 调用超时（>${Math.round(DEFAULT_TIMEOUT_MS / 1000)} 秒），请重试或更换模型`);
  }

  const status = getErrorStatus(error);
  if (status === 404) {
    const baseUrl = getResolvedBaseUrl(config);
    return new Error(`LLM 接口返回 404，请检查 Base URL 是否填写为 API 根路径。当前使用：${baseUrl}`);
  }

  return error instanceof Error ? error : new Error('LLM 调用失败');
}

/** 调用 LLM 获取完整响应 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  config?: LLMConfig,
  options: CallLLMOptions = {}
): Promise<string> {
  const client = getClient(config);
  const model = getModel(config);
  const shouldUseJsonMode = options.responseFormat === 'json_object' && supportsJsonResponseFormat(model);
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
        ...(shouldUseJsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      lastError = normalizeLLMError(error, config);
      if (attempt === MAX_RETRIES || !shouldRetryLLMError(error)) {
        throw lastError;
      }
      await delay(RETRY_BASE_DELAY_MS * (2 ** attempt));
    }
  }

  throw lastError ?? new Error('LLM 调用失败');
}

/** 调用 LLM 获取流式响应 */
export async function* streamLLM(
  systemPrompt: string,
  userMessage: string,
  config?: LLMConfig,
  maxTokens?: number
): AsyncGenerator<string> {
  const client = getClient(config);
  const resolvedMaxTokens = maxTokens ?? estimateDynamicMaxTokens(systemPrompt, userMessage);
  try {
    const stream = await client.chat.completions.create({
      model: getModel(config),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: resolvedMaxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    throw normalizeLLMError(error, config);
  }
}

/** 分析小说 */
export async function analyzeNovel(text: string, genre: Genre, config?: LLMConfig): Promise<string> {
  const systemPrompt = getAnalysisPrompt(genre);
  return callLLM(systemPrompt, `以下是需要分析的小说文本：\n\n${text}`, config, {
    responseFormat: 'json_object',
  });
}

/** 生成大纲 */
export async function generateOutline(
  analysisJson: string,
  genre: Genre,
  episodeCount: number,
  config?: LLMConfig
): Promise<string> {
  const systemPrompt = getOutlinePrompt(genre, episodeCount);
  return callLLM(systemPrompt, `以下是小说分析结果：\n\n${analysisJson}`, config, {
    responseFormat: 'json_object',
  });
}

/** 流式生成剧本 */
export async function* generateScript(
  outlineJson: string,
  analysisJson: string,
  genre: Genre,
  episodeNumber: number,
  generateConfig: Pick<GenerateConfig, 'episodeDuration' | 'style'>,
  config?: LLMConfig
): AsyncGenerator<string> {
  const systemPrompt = getScriptPrompt(genre, generateConfig);
  const userMessage = `## 角色和剧情分析
${analysisJson}

## 分集大纲
${outlineJson}

请生成第 ${episodeNumber} 集的完整剧本。
请严格遵守本次配置的单集时长 ${generateConfig.episodeDuration} 和风格 ${generateConfig.style}。`;

  yield* streamLLM(systemPrompt, userMessage, config);
}

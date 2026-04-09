import OpenAI from 'openai';
import {
  DEFAULT_LLM_MAX_RETRIES,
  DEFAULT_LLM_TIMEOUT_MS,
  normalizeLLMBaseUrl,
} from '@/lib/llm-config';
import { delay } from '@/lib/timing';
import { GenerateConfig, Genre } from '@/lib/types';
import { getAnalysisPrompt, getOutlinePrompt, getScriptPrompt } from '@/lib/prompts/index';

/**
 * LLM 服务层
 * 封装对 OpenAI-compatible API 的调用（支持 GPT / Claude / DeepSeek / Gemini 等）
 */

export interface LLMConfig {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  timeoutMs?: number;
  fallbacks?: LLMConfig[];
  label?: string;
}

export interface CallLLMOptions {
  responseFormat?: 'text' | 'json_object';
  maxTokens?: number;
}

interface LLMError extends Error {
  status?: number;
}

interface ResolvedLLMProvider {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  timeoutMs: number;
  label: string;
}

const DEFAULT_MAX_TOKENS = 4096;
const RETRY_BASE_DELAY_MS = 500;
const ANALYSIS_INPUT_BYTE_LIMITS = [24_000, 16_000, 12_000];
const DEFAULT_LLM_STREAM_IDLE_TIMEOUT_MS = 45_000;

function getResolvedApiKey(config?: LLMConfig) {
  return config?.apiKey || process.env.LLM_API_KEY || '';
}

function getResolvedBaseUrl(config?: LLMConfig) {
  return normalizeLLMBaseUrl(config?.baseUrl || process.env.LLM_BASE_URL);
}

function getModel(config?: LLMConfig) {
  return config?.modelName || process.env.LLM_MODEL_NAME || 'gemini-2.5-flash';
}

function supportsJsonResponseFormat(modelName: string): boolean {
  const model = modelName.toLowerCase();
  return (
    model.startsWith('gpt-') ||
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('o4') ||
    model.startsWith('gemini-')
  );
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

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  for (const key of ['message', 'error', 'type', 'code'] as const) {
    const value = Reflect.get(error, key);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function createLLMError(message: string, status?: number): LLMError {
  const error = new Error(message) as LLMError;
  if (typeof status === 'number') {
    error.status = status;
  }
  return error;
}

function createStreamTimeoutError(
  provider: ResolvedLLMProvider,
  phase: 'connect' | 'stream'
): LLMError {
  const seconds = Math.round(provider.timeoutMs / 1000);
  return createLLMError(
    phase === 'connect'
      ? `LLM 流式调用超时（>${seconds} 秒未建立响应），请重试或更换模型`
      : `LLM 流式输出超时（>${seconds} 秒未完成，且超过 ${Math.round(DEFAULT_LLM_STREAM_IDLE_TIMEOUT_MS / 1000)} 秒未返回新内容），请重试或更换模型`,
    408
  );
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

function shouldFallbackToNextProvider(error: unknown): boolean {
  if (isTimeoutError(error)) return true;

  const status = getErrorStatus(error);
  if (typeof status === 'number') {
    return status === 401 || status === 403 || status === 404 || status === 408 || status === 409 || status === 429 || status >= 500;
  }

  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('account has been deactivated')
  );
}

function normalizeLLMError(error: unknown, config?: LLMConfig): Error {
  if (error instanceof Error && 'status' in error) {
    return error;
  }

  const status = getErrorStatus(error);
  if (isTimeoutError(error)) {
    return createLLMError(
      `LLM 调用超时（>${Math.round(DEFAULT_LLM_TIMEOUT_MS / 1000)} 秒），请重试或更换模型`,
      status
    );
  }

  const model = getModel(config);
  const baseUrl = getResolvedBaseUrl(config);
  const providerMessage = getErrorMessage(error);
  if (status === 404) {
    return createLLMError(`LLM 接口返回 404，请检查 Base URL 是否填写为 API 根路径。当前使用：${baseUrl}`, status);
  }

  if (status === 400 || status === 403) {
    return createLLMError(
      `LLM 请求被上游拒绝（${status}）。当前模型 ${model}，接口 ${baseUrl}。` +
        '这通常表示 OpenAI-compatible 网关 / 模型配置不兼容，或分析输入过长。' +
        (providerMessage ? ` 原始信息：${providerMessage}` : ''),
      status
    );
  }

  if (status && providerMessage) {
    return createLLMError(`LLM 调用失败（${status}）：${providerMessage}`, status);
  }

  if (providerMessage) {
    return createLLMError(`LLM 调用失败：${providerMessage}`, status);
  }

  return createLLMError('LLM 调用失败', status);
}

function resolvePrimaryProvider(config?: LLMConfig): ResolvedLLMProvider | null {
  const apiKey = getResolvedApiKey(config).trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: getResolvedBaseUrl(config),
    modelName: getModel(config),
    timeoutMs: config?.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS,
    label: config?.label?.trim() || 'primary',
  };
}

function resolveFallbackProviders(config?: LLMConfig): ResolvedLLMProvider[] {
  return (config?.fallbacks ?? []).flatMap((fallback, index) => {
    const apiKey = fallback.apiKey?.trim();
    if (!apiKey) {
      return [];
    }

    return [{
      apiKey,
      baseUrl: normalizeLLMBaseUrl(fallback.baseUrl || config?.baseUrl || process.env.LLM_BASE_URL),
      modelName: fallback.modelName || config?.modelName || process.env.LLM_MODEL_NAME || 'gemini-2.5-flash',
      timeoutMs: fallback.timeoutMs ?? config?.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS,
      label: fallback.label?.trim() || `fallback-${index + 1}`,
    }];
  });
}

function getProviderChain(config?: LLMConfig): ResolvedLLMProvider[] {
  const providers = [
    resolvePrimaryProvider(config),
    ...resolveFallbackProviders(config),
  ].filter((provider): provider is ResolvedLLMProvider => Boolean(provider));

  const seen = new Set<string>();
  return providers.filter((provider) => {
    const key = `${provider.baseUrl}::${provider.modelName}::${provider.apiKey}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function createClientFromProvider(provider: ResolvedLLMProvider) {
  return new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
    timeout: provider.timeoutMs,
  });
}

function createProviderScopedConfig(provider: ResolvedLLMProvider): LLMConfig {
  return {
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    modelName: provider.modelName,
    timeoutMs: provider.timeoutMs,
    label: provider.label,
  };
}

function formatProviderFailure(provider: ResolvedLLMProvider, error: Error): string {
  return `${provider.label}:${error.message}`;
}

function buildMultiProviderError(lastError: Error, providerFailures: string[]): Error {
  if (providerFailures.length === 0) {
    return lastError;
  }

  return createLLMError(
    `${lastError.message}。已尝试备用线路：${providerFailures.join('；')}`,
    getErrorStatus(lastError)
  );
}

/** 调用 LLM 获取完整响应 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  config?: LLMConfig,
  options: CallLLMOptions = {}
): Promise<string> {
  const providers = getProviderChain(config);
  const maxTokens = options.maxTokens ?? estimateDynamicMaxTokens(systemPrompt, userMessage);
  const providerFailures: string[] = [];
  let lastError: Error | null = null;

  for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
    const provider = providers[providerIndex];
    const client = createClientFromProvider(provider);
    const providerConfig = createProviderScopedConfig(provider);
    const shouldUseJsonMode =
      options.responseFormat === 'json_object' && supportsJsonResponseFormat(provider.modelName);

    for (let attempt = 0; attempt <= DEFAULT_LLM_MAX_RETRIES; attempt += 1) {
      try {
        const response = await client.chat.completions.create({
          model: provider.modelName,
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
        lastError = normalizeLLMError(error, providerConfig);
        if (attempt < DEFAULT_LLM_MAX_RETRIES && shouldRetryLLMError(error)) {
          await delay(RETRY_BASE_DELAY_MS * (2 ** attempt));
          continue;
        }

        if (providerIndex < providers.length - 1 && shouldFallbackToNextProvider(error)) {
          providerFailures.push(formatProviderFailure(provider, lastError));
          break;
        }

        throw buildMultiProviderError(lastError, providerFailures);
      }
    }
  }

  throw buildMultiProviderError(lastError ?? new Error('LLM 调用失败'), providerFailures);
}

/** 调用 LLM 获取流式响应 */
export async function* streamLLM(
  systemPrompt: string,
  userMessage: string,
  config?: LLMConfig,
  maxTokens?: number
): AsyncGenerator<string> {
  const resolvedMaxTokens = maxTokens ?? estimateDynamicMaxTokens(systemPrompt, userMessage);
  const providers = getProviderChain(config);
  const providerFailures: string[] = [];
  let lastError: Error | null = null;

  for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
    const provider = providers[providerIndex];
    const client = createClientFromProvider(provider);
    const providerConfig = createProviderScopedConfig(provider);

    for (let attempt = 0; attempt <= DEFAULT_LLM_MAX_RETRIES; attempt += 1) {
      let emittedContent = false;
      const controller = new AbortController();
      let timeoutError: Error | null = null;
      let connectTimer: ReturnType<typeof setTimeout> | null = null;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const clearTimers = () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      };

      const armIdleTimer = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }

        idleTimer = setTimeout(() => {
          timeoutError = createStreamTimeoutError(provider, 'stream');
          controller.abort();
        }, Math.min(provider.timeoutMs, DEFAULT_LLM_STREAM_IDLE_TIMEOUT_MS));
      };

      try {
        connectTimer = setTimeout(() => {
          timeoutError = createStreamTimeoutError(provider, 'connect');
          controller.abort();
        }, provider.timeoutMs);

        const stream = await client.chat.completions.create({
          model: provider.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: resolvedMaxTokens,
          stream: true,
        }, {
          signal: controller.signal,
        });

        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }

        armIdleTimer();

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            emittedContent = true;
            armIdleTimer();
            yield content;
          }
        }

        clearTimers();
        return;
      } catch (error) {
        clearTimers();
        const effectiveError = timeoutError ?? error;
        lastError = timeoutError ?? normalizeLLMError(error, providerConfig);
        if (!emittedContent && attempt < DEFAULT_LLM_MAX_RETRIES && shouldRetryLLMError(effectiveError)) {
          await delay(RETRY_BASE_DELAY_MS * (2 ** attempt));
          continue;
        }

        if (!emittedContent && providerIndex < providers.length - 1 && shouldFallbackToNextProvider(effectiveError)) {
          providerFailures.push(formatProviderFailure(provider, lastError));
          break;
        }

        throw buildMultiProviderError(lastError, providerFailures);
      }
    }
  }

  throw buildMultiProviderError(lastError ?? new Error('LLM 调用失败'), providerFailures);
}

/** 分析小说 */
export async function analyzeNovel(text: string, genre: Genre, config?: LLMConfig): Promise<string> {
  const systemPrompt = getAnalysisPrompt(genre);
  const analysisCandidates = buildAnalysisCandidates(text);
  let lastError: Error | null = null;

  for (let index = 0; index < analysisCandidates.length; index += 1) {
    try {
      return await callLLM(systemPrompt, `以下是需要分析的小说文本：\n\n${analysisCandidates[index]}`, config, {
        responseFormat: 'json_object',
      });
    } catch (error) {
      const normalizedError = normalizeLLMError(error, config) as LLMError;
      const canRetryWithSmallerInput =
        index < analysisCandidates.length - 1 &&
        typeof normalizedError.status === 'number' &&
        [400, 413, 422].includes(normalizedError.status);

      if (!canRetryWithSmallerInput) {
        throw normalizedError;
      }

      lastError = normalizedError;
    }
  }

  throw lastError ?? new Error('小说分析失败');
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

function buildAnalysisCandidates(text: string): string[] {
  const sanitized = sanitizeLLMInput(text);
  const candidates = ANALYSIS_INPUT_BYTE_LIMITS
    .map((limit) => trimTextToUtf8Bytes(sanitized, limit))
    .filter((candidate) => candidate.length > 0);

  return Array.from(new Set(candidates));
}

function sanitizeLLMInput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function trimTextToUtf8Bytes(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) {
    return text;
  }

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = text.slice(0, mid);
    if (encoder.encode(candidate).length <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return text.slice(0, low).trimEnd();
}

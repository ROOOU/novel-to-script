import OpenAI from 'openai';
import { Genre } from '@/lib/types';
import { getAnalysisPrompt, getOutlinePrompt, getScriptPrompt } from '@/lib/prompts/index';

/**
 * LLM 服务层
 * 封装对 OpenAI-compatible API 的调用（支持 Claude / GPT / DeepSeek 等）
 */

export interface LLMConfig {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

function getClient(config?: LLMConfig) {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY || process.env.API_KEY || '';
  const baseURL = config?.baseUrl || process.env.OPENAI_BASE_URL || process.env.API_BASE_URL || 'https://api.openai.com/v1';

  return new OpenAI({ apiKey, baseURL });
}

function getModel(config?: LLMConfig) {
  return config?.modelName || process.env.MODEL_NAME || 'gpt-4o';
}

/** 调用 LLM 获取完整响应 */
export async function callLLM(systemPrompt: string, userMessage: string, config?: LLMConfig): Promise<string> {
  const client = getClient(config);
  const response = await client.chat.completions.create({
    model: getModel(config),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || '';
}

/** 调用 LLM 获取流式响应 */
export async function* streamLLM(
  systemPrompt: string,
  userMessage: string,
  config?: LLMConfig,
  maxTokens: number = 4096
): AsyncGenerator<string> {
  const client = getClient(config);
  const stream = await client.chat.completions.create({
    model: getModel(config),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/** 分析小说 */
export async function analyzeNovel(text: string, genre: Genre, config?: LLMConfig): Promise<string> {
  const systemPrompt = getAnalysisPrompt(genre);
  return callLLM(systemPrompt, `以下是需要分析的小说文本：\n\n${text}`, config);
}

/** 生成大纲 */
export async function generateOutline(
  analysisJson: string,
  genre: Genre,
  episodeCount: number,
  config?: LLMConfig
): Promise<string> {
  const systemPrompt = getOutlinePrompt(genre, episodeCount);
  return callLLM(systemPrompt, `以下是小说分析结果：\n\n${analysisJson}`, config);
}

/** 流式生成剧本 */
export async function* generateScript(
  outlineJson: string,
  analysisJson: string,
  genre: Genre,
  episodeNumber: number,
  config?: LLMConfig
): AsyncGenerator<string> {
  const systemPrompt = getScriptPrompt(genre);
  const userMessage = `## 角色和剧情分析
${analysisJson}

## 分集大纲
${outlineJson}

请生成第 ${episodeNumber} 集的完整剧本。`;

  yield* streamLLM(systemPrompt, userMessage, config);
}

import { NextRequest } from 'next/server';
import { streamLLM, LLMConfig } from '@/lib/llm';
import {
  getStoryboardSafeUserPrompt,
  getStoryboardSystemPrompt,
  getStoryboardUserPrompt,
} from '@/lib/prompts/storyboard';

function extractLLMConfig(request: NextRequest): LLMConfig {
  return {
    apiKey: request.headers.get('x-api-key') || undefined,
    baseUrl: request.headers.get('x-base-url') || undefined,
    modelName: request.headers.get('x-model-name') || undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const llmConfig = extractLLMConfig(request);

    const { scriptText, visualStyle, colorTone, genreLabel, safeMode } = body;

    if (!scriptText) {
      return new Response(
        JSON.stringify({ error: '请输入剧本文本' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const send = (data: object) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          };

          send({ step: 'parsing', message: '正在解析剧本结构...' });

          // 提取角色和场景信息（简单正则预处理）
          const characters = extractCharacters(scriptText);
          const scenes = extractScenes(scriptText);

          send({
            step: 'parsed',
            message: `识别到 ${characters.length} 个角色，${scenes.length} 个场景`,
            characters,
            scenes,
          });

          send({ step: 'generating', message: '正在生成分镜提示词...' });

          const systemPrompt = getStoryboardSystemPrompt();
          const resolvedVisualStyle = visualStyle || '真人写实';
          const resolvedColorTone = colorTone || '暖色调';
          const resolvedGenreLabel = genreLabel || '都市女频';
          const promptScriptText = safeMode ? softenSensitiveContent(scriptText) : scriptText;
          const userPrompt = safeMode
            ? getStoryboardSafeUserPrompt(
                promptScriptText,
                resolvedVisualStyle,
                resolvedColorTone,
                resolvedGenreLabel
              )
            : getStoryboardUserPrompt(
                promptScriptText,
                resolvedVisualStyle,
                resolvedColorTone,
                resolvedGenreLabel
              );

          try {
            const fullContent = await streamStoryboard(systemPrompt, userPrompt, llmConfig, send);

            send({
              step: 'done',
              message: safeMode ? '安全影视化模式生成完成！' : '分镜提示词生成完成！',
              content: fullContent,
            });
          } catch (error) {
            if (!isContentPolicyError(error)) {
              throw error;
            }

            if (safeMode) {
              throw new Error('安全内容错误，安全影视化模式下仍被拦截，请进一步删减敏感描述或更换模型。');
            }

            send({
              step: 'content_policy_blocked',
              message: '安全内容错误：当前剧本包含模型安全策略拦截的描述。',
              retryPrompt: '是否继续以安全影视化模式重试？',
            });
          }
        } catch (error) {
          const message = isContentPolicyError(error)
            ? '安全内容错误：输入内容被模型安全策略拦截，请删减过于露骨、血腥或违规的描述。'
            : error instanceof Error
              ? error.message
              : '生成分镜提示词失败，请检查 API 配置';

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                step: 'error',
                message,
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Storyboard generation error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '请求失败',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

type StoryboardSender = (data: object) => void;

async function streamStoryboard(
  systemPrompt: string,
  userPrompt: string,
  llmConfig: LLMConfig,
  send: StoryboardSender
): Promise<string> {
  let fullContent = '';

  for await (const chunk of streamLLM(systemPrompt, userPrompt, llmConfig, 8192)) {
    fullContent += chunk;
    send({
      step: 'streaming',
      chunk,
      content: fullContent,
    });
  }

  return fullContent;
}

function isContentPolicyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return [
    'inappropriate content',
    'content policy',
    'content filter',
    'safety',
    'moderation',
    'sensitive',
    'unsafe',
    'violat',
  ].some((keyword) => message.includes(keyword));
}

function softenSensitiveContent(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/(强奸|性侵|猥亵|迷奸|轮奸)/gi, '强迫伤害'],
    [/(性交|做爱|性爱|床戏|上床|裸露|赤裸|下体|乳房|呻吟)/gi, '亲密行为'],
    [/(杀人|捅死|砍死|爆头|割喉|血肉模糊|尸体|碎尸)/gi, '激烈冲突'],
    [/(自杀|跳楼|割腕|上吊)/gi, '危险场面'],
    [/(吸毒|贩毒|毒品)/gi, '违禁物品'],
  ];

  return replacements.reduce((result, [pattern, replacement]) => {
    return result.replace(pattern, replacement);
  }, text);
}

/** 从剧本文本中提取角色名 */
function extractCharacters(text: string): string[] {
  const characters = new Set<string>();

  // 模式1：人物：角色1, 角色2, ...
  const castMatch = text.match(/人物[：:]\s*(.+)/);
  if (castMatch) {
    castMatch[1].split(/[,，、\s]+/).forEach((name) => {
      const cleaned = name.trim().replace(/若干|等/g, '');
      if (cleaned && cleaned.length <= 6) characters.add(cleaned);
    });
  }

  // 模式2：独立一行的角色名 + 对白（如"司仪：今天..."）
  const dialoguePattern = /^([^\s（(△【\d][^\s：:]{1,5})[（(]?[^)）]*[)）]?[：:]/gm;
  let match;
  while ((match = dialoguePattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (name && name.length <= 6 && !/^[\d\-]+$/.test(name)) {
      characters.add(name);
    }
  }

  return Array.from(characters);
}

/** 从剧本文本中提取场景 */
function extractScenes(text: string): string[] {
  const scenes: string[] = [];

  // 模式：1-1 日 内 场景名
  const scenePattern = /\d+-\d+\s+(日|夜|晨|暮|黄昏)\s*(内|外|内外)\s*(.+?)(?:\s|$)/gm;
  let match;
  while ((match = scenePattern.exec(text)) !== null) {
    scenes.push(match[3].trim());
  }

  // 如果没匹配到，尝试提取"场景"标记
  if (scenes.length === 0) {
    const altPattern = /(?:INT\.|EXT\.|内|外)[.\s]*(.+?)(?:\s*[-—]\s*(日|夜))?$/gm;
    while ((match = altPattern.exec(text)) !== null) {
      scenes.push(match[1].trim());
    }
  }

  return scenes;
}

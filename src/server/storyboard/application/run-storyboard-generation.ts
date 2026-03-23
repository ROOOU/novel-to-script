import { streamLLM } from '@/lib/llm';
import {
  getStoryboardSafeUserPrompt,
  getStoryboardSystemPrompt,
  getStoryboardUserPrompt,
} from '@/lib/prompts/storyboard';
import {
  type StoryboardGenerateRequestV2,
} from '@/features/storyboard/contracts';
import { getPlatformRuntime } from '@/server/shared/platform';
import { extractCharacters, extractScenes } from './extract-helpers';
import { buildStoryboardUsageEvent, type StoryboardGenerationExecutionOptions } from './types';

export function getStoryboardRequestError(
  body: Partial<StoryboardGenerateRequestV2> | null | undefined
): string | null {
  if (normalizeStoryboardArtifactIds(body?.scriptArtifactIds).length > 0) {
    return null;
  }

  if (typeof body?.scriptText === 'string' && body.scriptText.trim()) {
    return null;
  }

  return '请输入剧本文本或剧本工件';
}

export async function runStoryboardGeneration(
  {
    body,
    context,
    jobId,
    send,
    llmConfig,
    usageMeter,
    onProgress,
    onArtifact,
  }: StoryboardGenerationExecutionOptions
): Promise<void> {
  const source = await resolveStoryboardScriptSource(body);
  const scriptText = source.scriptText;

  usageMeter?.record(
    buildStoryboardUsageEvent(context, scriptText.length, 'character', {
      phase: 'request_received',
      jobId,
    })
  );
  usageMeter?.record(
    buildStoryboardUsageEvent(context, 1, 'job', {
      phase: 'job_started',
      jobId,
    })
  );

  send({ step: 'parsing', message: '正在解析剧本结构...' });
  await onProgress?.({ progress: 10, currentStep: 'parsing' });

  const characters = extractCharacters(scriptText);
  const scenes = extractScenes(scriptText);

  send({
    step: 'parsed',
    message: `识别到 ${characters.length} 个角色，${scenes.length} 个场景`,
    characters,
    scenes,
  });
  await onProgress?.({ progress: 20, currentStep: 'parsed', outputSummary: `characters:${characters.length};scenes:${scenes.length}` });

  send({ step: 'generating', message: '正在生成分镜提示词...' });
  await onProgress?.({ progress: 30, currentStep: 'generating' });

  const systemPrompt = getStoryboardSystemPrompt();
  const resolvedVisualStyle = body.visualStyle || '真人写实';
  const resolvedColorTone = body.colorTone || '暖色调';
  const resolvedGenreLabel = body.genreLabel || '都市女频';
  const promptScriptText = body.safeMode
    ? softenSensitiveContent(scriptText)
    : scriptText;
  const userPrompt = body.safeMode
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
    const fullContent = await streamStoryboard(systemPrompt, userPrompt, send, llmConfig);

    send({
      step: 'done',
      message: body.safeMode ? '安全影视化模式生成完成！' : '分镜提示词生成完成！',
      content: fullContent,
    });
    await onArtifact?.({
      kind: 'storyboard',
      title: '分镜提示词',
      format: 'text/plain',
      content: fullContent,
      metadata: {
        safeMode: Boolean(body.safeMode),
        characters,
        scenes,
        ...(source.sourceScriptArtifactIds.length > 0
          ? { sourceScriptArtifactIds: source.sourceScriptArtifactIds }
          : {}),
      },
    });
    usageMeter?.record(
      buildStoryboardUsageEvent(context, 1, 'request', {
        phase: 'job_completed',
        safeMode: Boolean(body.safeMode),
        jobId,
      })
    );
    await onProgress?.({ progress: 100, currentStep: 'done', outputSummary: 'storyboard generated' });
  } catch (error) {
    if (!isContentPolicyError(error)) {
      throw error;
    }

    if (body.safeMode) {
      throw new Error('安全内容错误，安全影视化模式下仍被拦截，请进一步删减敏感描述或更换模型。');
    }

    send({
      step: 'content_policy_blocked',
      message: '安全内容错误：当前剧本包含模型安全策略拦截的描述。',
      retryPrompt: '是否继续以安全影视化模式重试？',
    });
    await onProgress?.({ progress: 0, currentStep: 'content_policy_blocked', outputSummary: 'retry in safe mode' });
  }
}

async function streamStoryboard(
  systemPrompt: string,
  userPrompt: string,
  send: StoryboardGenerationExecutionOptions['send'],
  llmConfig: StoryboardGenerationExecutionOptions['llmConfig']
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

export interface StoryboardScriptSourceResolution {
  scriptText: string;
  sourceScriptArtifactIds: string[];
}

export async function resolveStoryboardScriptSource(
  body: StoryboardGenerateRequestV2
): Promise<StoryboardScriptSourceResolution> {
  const sourceScriptArtifactIds = normalizeStoryboardArtifactIds(body.scriptArtifactIds);
  if (sourceScriptArtifactIds.length === 0) {
    const fallbackScriptText = body.scriptText?.trim() ?? '';
    if (!fallbackScriptText) {
      throw new Error('请输入剧本文本或剧本工件');
    }

    return {
      scriptText: fallbackScriptText,
      sourceScriptArtifactIds: [],
    };
  }

  const runtime = getPlatformRuntime();
  const artifacts = await Promise.all(
    sourceScriptArtifactIds.map(async (artifactId) => {
      const artifact = await runtime.generationArtifacts.getById(artifactId);
      if (!artifact) {
        throw new Error(`SCRIPT_ARTIFACT_NOT_FOUND:${artifactId}`);
      }

      if (artifact.kind !== 'script') {
        throw new Error(`SCRIPT_ARTIFACT_KIND_INVALID:${artifactId}`);
      }

      return artifact;
    })
  );

  const scriptText = artifacts
    .map((artifact, index) => {
      if (!artifact.content?.trim()) {
        throw new Error(`SCRIPT_ARTIFACT_EMPTY:${sourceScriptArtifactIds[index]}`);
      }
      return artifact.content;
    })
    .join('\n\n');

  return {
    scriptText,
    sourceScriptArtifactIds,
  };
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

function normalizeStoryboardArtifactIds(ids: string[] | null | undefined): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  const normalized = ids
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return Array.from(new Set(normalized));
}

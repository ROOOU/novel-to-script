import { streamLLM } from '@/lib/llm';
import {
  getStoryboardSafeUserPrompt,
  getStoryboardSystemPrompt,
  getStoryboardUserPrompt,
} from '@/lib/prompts/storyboard';
import {
  type StoryboardGenerateRequestV2,
} from '@/features/storyboard/contracts';
import { artifactBelongsToScope } from '@/server/auth/viewer-access';
import {
  getPlatformRuntime,
  type StoryboardMetadata,
  type StoryboardShot,
} from '@/server/shared/platform';
import { withProgressHeartbeat } from '@/server/generation/progress-heartbeat';
import { extractCharacters, extractScenes } from './extract-helpers';
import { compilePromptPack } from '@/server/storyboard/prompt-compiler';
import { buildStoryboardUsageEvent, type StoryboardGenerationExecutionOptions } from './types';

export function getStoryboardRequestError(
  body: Partial<StoryboardGenerateRequestV2> | null | undefined
): string | null {
  const scope = normalizeStoryboardScope(body?.scope);
  const selection = normalizeStoryboardSelection(body?.selection);
  const hasScriptArtifacts = normalizeStoryboardArtifactIds(body?.scriptArtifactIds).length > 0;
  const hasSelectedArtifacts = selection.artifactIds.length > 0;

  if (hasScriptArtifacts || (scope === 'selection' && hasSelectedArtifacts)) {
    if (scope === 'selection' && !hasStoryboardSelectionCriteria(selection)) {
      return '请选择需要生成分镜的集数、场景或剧本工件';
    }

    return null;
  }

  if (typeof body?.scriptText === 'string' && body.scriptText.trim()) {
    if (scope === 'selection' && hasStoryboardSelectionCriteria(selection)) {
      return '按集数或场景筛选时，请选择剧本工件作为输入来源';
    }

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
  const source = await resolveStoryboardScriptSource(body, {
    organizationId: context.organizationId,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
  });
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
        resolvedGenreLabel,
        body.targetPlatform
      )
    : getStoryboardUserPrompt(
        promptScriptText,
        resolvedVisualStyle,
        resolvedColorTone,
        resolvedGenreLabel,
        body.targetPlatform
      );

  const generateStoryboardDraft = (draftPrompt: string) =>
    withProgressHeartbeat(
      {
        onProgress,
        progress: 30,
        currentStep: 'generating',
        outputSummary: 'storyboard drafting',
      },
      () => streamStoryboard(systemPrompt, draftPrompt, send, llmConfig)
    );

  let fullContent = '';
  let safetyFallbackApplied = false;
  let safetyFallbackMode: 'summary-retry' | 'local-template' | null = null;

  try {
    fullContent = await generateStoryboardDraft(userPrompt);
  } catch (error) {
    if (!isContentPolicyError(error)) {
      throw error;
    }

    if (!body.safeMode) {
      send({
        step: 'content_policy_blocked',
        message: '安全内容错误：当前剧本包含模型安全策略拦截的描述。',
        retryPrompt: '是否继续以安全影视化模式重试？',
      });
      await onProgress?.({
        progress: 0,
        currentStep: 'content_policy_blocked',
        outputSummary: 'retry in safe mode',
      });
      return;
    }

    send({
      step: 'safety_retry',
      message: '安全影视化模式首次生成仍被拦截，正在切换到摘要化安全重试...',
    });
    await onProgress?.({
      progress: 35,
      currentStep: 'safety_retry',
      outputSummary: 'storyboard safety retry',
    });

    const retryScriptText = buildSafeStoryboardRetrySource(scriptText, characters, scenes);
    const retryUserPrompt = getStoryboardSafeUserPrompt(
      retryScriptText,
      resolvedVisualStyle,
      resolvedColorTone,
      resolvedGenreLabel,
      body.targetPlatform
    );

    try {
      fullContent = await generateStoryboardDraft(retryUserPrompt);
      safetyFallbackApplied = true;
      safetyFallbackMode = 'summary-retry';
    } catch (retryError) {
      if (isContentPolicyError(retryError)) {
        fullContent = buildLocalSafeStoryboardOutput({
          scriptText,
          characters,
          scenes,
          visualStyle: resolvedVisualStyle,
          colorTone: resolvedColorTone,
          genreLabel: resolvedGenreLabel,
        });
        safetyFallbackApplied = true;
        safetyFallbackMode = 'local-template';
      } else {
        throw retryError;
      }
    }
  }

  try {
    const parsedOutput = resolveStoryboardOutput(fullContent);
    const metadata: StoryboardMetadata = {
      safeMode: Boolean(body.safeMode),
      ...(safetyFallbackApplied ? { safetyFallbackApplied: true } : {}),
      ...(safetyFallbackMode ? { safetyFallbackMode } : {}),
      characters,
      scenes,
      shots: parsedOutput.shots,
      shotCount: parsedOutput.shots.length,
      ...(parsedOutput.parseError ? { parseError: parsedOutput.parseError } : {}),
      ...(parsedOutput.parseFallbackMode ? { parseFallbackMode: parsedOutput.parseFallbackMode } : {}),
      ...(parsedOutput.invalidShotIndexes && parsedOutput.invalidShotIndexes.length > 0
        ? { invalidShotIndexes: parsedOutput.invalidShotIndexes }
        : {}),
      ...(parsedOutput.invalidShotErrors && parsedOutput.invalidShotErrors.length > 0
        ? { invalidShotErrors: parsedOutput.invalidShotErrors }
        : {}),
      ...(source.sourceScriptArtifactIds.length > 0
        ? { sourceScriptArtifactIds: source.sourceScriptArtifactIds }
        : {}),
    };

    send({
      step: 'done',
      message: parsedOutput.parseError
        ? parsedOutput.shots.length > 0
          ? parsedOutput.parseFallbackMode === 'partial-text-derived'
            ? '分镜提示词生成完成，部分结构化镜头已保留，其余镜头已从文本补齐。'
            : '分镜提示词生成完成，结构化 JSON 未完全命中，已从文本补齐镜头清单。'
          : '分镜提示词生成完成，结构化镜头清单解析失败，已保留文本结果。'
        : safetyFallbackMode === 'local-template'
          ? '安全影视化模式生成完成，已启用本地安全兜底分镜。'
        : safetyFallbackApplied
          ? '安全影视化模式生成完成，已启用二次降敏重试。'
        : body.safeMode
          ? '安全影视化模式生成完成！'
          : '分镜提示词生成完成！',
      content: parsedOutput.textContent,
    });
    await onArtifact?.({
      kind: 'storyboard',
      title: '分镜提示词',
      format: 'text/plain',
      content: parsedOutput.textContent,
      metadata,
    });
    await onArtifact?.({
      kind: 'shot_plan',
      title: '结构化镜头计划',
      format: 'application/json',
      content: JSON.stringify(parsedOutput.shots, null, 2),
      metadata: {
        ...metadata,
        downloadFilename: 'shot-plan.json',
      },
    });
    await onArtifact?.({
      kind: 'prompt_pack',
      title: '视频提示词包',
      format: 'application/json',
      content: JSON.stringify(
        compilePromptPack(parsedOutput.shots, {
          visualStyle: resolvedVisualStyle,
          colorTone: resolvedColorTone,
          genreLabel: resolvedGenreLabel,
          safeMode: body.safeMode,
          targetPlatform: body.targetPlatform,
        }),
        null,
        2
      ),
      metadata: {
        ...metadata,
        targetPlatform: body.targetPlatform ?? 'generic-video',
        downloadFilename: 'prompt-pack.json',
      },
    });
    usageMeter?.record(
      buildStoryboardUsageEvent(context, 1, 'request', {
        phase: 'job_completed',
        safeMode: Boolean(body.safeMode),
        jobId,
      })
    );
    await onProgress?.({
      progress: 100,
      currentStep: 'done',
      outputSummary: parsedOutput.parseError
        ? parsedOutput.shots.length > 0
          ? `storyboard generated;shots:${parsedOutput.shots.length};fallback:${parsedOutput.parseFallbackMode ?? 'text-derived'}`
          : `storyboard generated;shots:${parsedOutput.shots.length};fallback:text-only`
        : safetyFallbackMode === 'local-template'
          ? `storyboard generated;shots:${parsedOutput.shots.length};safetyFallback:local-template`
        : safetyFallbackApplied
          ? `storyboard generated;shots:${parsedOutput.shots.length};safetyFallback:summary-retry`
          : `storyboard generated;shots:${parsedOutput.shots.length}`,
    });
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

export interface ParsedStoryboardOutput {
  textContent: string;
  shots: StoryboardShot[];
  parseError?: string | null;
  parseFallbackMode?: 'text-derived' | 'partial-text-derived' | null;
  invalidShotIndexes?: number[];
  invalidShotErrors?: string[];
}

const STORYBOARD_JSON_BLOCK_PATTERN =
  /\[SHOTS_JSON\]\s*(?:```json\s*([\s\S]*?)\s*```|([\s\S]*?))(?:\s*\[\/SHOTS_JSON\])?/gi;
const STORYBOARD_JSON_FENCE_PATTERN = /```json\s*([\s\S]*?)\s*```/gi;
const STORYBOARD_GENERIC_FENCE_PATTERN = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```/gi;
const STORYBOARD_SHOT_BLOCK_PATTERN =
  /((?:分镜|镜头|Shot)\s*[#:：]?\s*[A-Za-z①②③④⑤⑥⑦⑧⑨⑩\d]+\s*[\s\S]*?)(?=(?:\n\s*(?:分镜|镜头|Shot)\s*[#:：]?\s*[A-Za-z①②③④⑤⑥⑦⑧⑨⑩\d]+)|$)/giu;

const STORYBOARD_SHOT_REQUIRED_FIELDS = [
  'sceneId',
  'shotId',
  'shotType',
  'camera',
  'composition',
  'motion',
  'subject',
  'environment',
  'lighting',
  'audioHint',
  'videoPrompt',
] as const satisfies ReadonlyArray<keyof StoryboardShot>;

const STORYBOARD_SHOT_FIELD_ALIASES: Record<keyof StoryboardShot, string[]> = {
  sceneId: ['sceneId', 'scene_id', 'scene'],
  shotId: ['shotId', 'shot_id', 'id'],
  shotType: ['shotType', 'shot_type', 'type'],
  camera: ['camera', 'cameraMovement', 'camera_motion', 'camera_move'],
  composition: ['composition', 'framing', 'layout'],
  motion: ['motion', 'action', 'movement'],
  subject: ['subject', 'character', 'focus', 'target'],
  environment: ['environment', 'sceneEnvironment', 'setting', 'location'],
  lighting: ['lighting', 'light', 'lightingSetup'],
  audioHint: ['audioHint', 'audio_hint', 'sound', 'soundHint', 'audio'],
  videoPrompt: ['videoPrompt', 'video_prompt', 'prompt', 'imagePrompt'],
};

export function parseStoryboardOutput(fullContent: string): ParsedStoryboardOutput {
  const trimmedContent = fullContent.trim();
  const extractedBlock = extractStoryboardJsonBlock(trimmedContent);
  if (!extractedBlock) {
    throw new Error('STORYBOARD_SHOTS_JSON_MISSING');
  }

  return {
    textContent: extractedBlock.textContent,
    shots: parseStoryboardShots(extractedBlock.jsonSource),
  };
}

function parseStoryboardShots(jsonSource: string): StoryboardShot[] {
  const parseCandidates = Array.from(
    new Set(
      [jsonSource, repairStoryboardJsonSource(jsonSource)]
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0)
    )
  );

  let lastError: Error | null = null;

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      return normalizeStoryboardShots(parsed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('STORYBOARD_SHOTS_JSON_INVALID');
    }
  }

  throw lastError ?? new Error('STORYBOARD_SHOTS_JSON_INVALID');
}

function normalizeStoryboardShots(parsed: unknown): StoryboardShot[] {
  const normalizedShots = resolveStoryboardShotCollection(parsed);

  if (!normalizedShots || normalizedShots.length === 0) {
    throw new Error('STORYBOARD_SHOTS_JSON_EMPTY');
  }

  return normalizedShots.map((entry, index) => validateStoryboardShot(entry, index));
}

function resolveStoryboardShotCollection(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  for (const key of ['shots', 'storyboard', 'storyboards']) {
    if (Array.isArray(parsed[key])) {
      return parsed[key] as unknown[];
    }
  }

  for (const key of ['data', 'result', 'payload', 'output']) {
    const nested = resolveStoryboardShotCollection(parsed[key]);
    if (nested) {
      return nested;
    }
  }

  for (const value of Object.values(parsed)) {
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }

    const looksLikeShots = value.some(
      (entry) => isRecord(entry) && (typeof entry.sceneId === 'string' || typeof entry.shotId === 'string')
    );
    if (looksLikeShots) {
      return value;
    }
  }

  return null;
}

function validateStoryboardShot(value: unknown, index: number): StoryboardShot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`STORYBOARD_SHOT_INVALID:${index}`);
  }

  const shotRecord = value as Record<string, unknown>;
  const validatedShot = {} as StoryboardShot;

  for (const field of STORYBOARD_SHOT_REQUIRED_FIELDS) {
    validatedShot[field] = readRequiredShotString(shotRecord, field, index);
  }

  return validatedShot;
}

function readRequiredShotString(
  record: Record<string, unknown>,
  field: keyof StoryboardShot,
  index: number
): string {
  const value = readShotFieldValue(record, field);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`STORYBOARD_SHOT_FIELD_INVALID:${index}:${field}`);
  }

  return value.trim();
}

function readShotFieldValue(record: Record<string, unknown>, field: keyof StoryboardShot): unknown {
  for (const alias of STORYBOARD_SHOT_FIELD_ALIASES[field]) {
    const value = record[alias];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function sanitizeStoryboardJsonSource(source: string): string {
  let normalized = source.replace(/\[\/SHOTS_JSON\]\s*$/i, '').trim();
  const fencedMatch = normalized.match(/^```json\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch) {
    normalized = fencedMatch[1]?.trim() ?? '';
  }

  const firstJsonTokenIndex = normalized.search(/[\[{]/);
  if (firstJsonTokenIndex > 0) {
    normalized = normalized.slice(firstJsonTokenIndex).trim();
  }

  const lastArrayIndex = normalized.lastIndexOf(']');
  const lastObjectIndex = normalized.lastIndexOf('}');
  const lastJsonBoundary = Math.max(lastArrayIndex, lastObjectIndex);
  if (lastJsonBoundary >= 0) {
    normalized = normalized.slice(0, lastJsonBoundary + 1).trim();
  }

  return normalized;
}

function repairStoryboardJsonSource(source: string): string {
  return sanitizeStoryboardJsonSource(source)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, '\'')
    .replace(/,\s*([}\]])/g, '$1');
}

function resolveStoryboardOutput(fullContent: string): ParsedStoryboardOutput {
  const trimmedContent = fullContent.trim();
  const extractedBlock = extractStoryboardJsonBlock(trimmedContent);

  try {
    return parseStoryboardOutput(fullContent);
  } catch (error) {
    const parseError = error instanceof Error ? error.message : 'STORYBOARD_PARSE_FAILED';
    const fallbackTextContent = stripStoryboardStructuredTail(fullContent);
    if (!fallbackTextContent) {
      throw error;
    }

    const inferredShots = inferStoryboardShotsFromText(fallbackTextContent);
    const salvagedResult =
      extractedBlock && inferredShots.length > 0
        ? salvageStoryboardShots(extractedBlock.jsonSource, inferredShots)
        : null;

    if (salvagedResult && salvagedResult.shots.length > 0) {
      return {
        textContent: fallbackTextContent,
        shots: salvagedResult.shots,
        parseError,
        parseFallbackMode: 'partial-text-derived',
        invalidShotIndexes: salvagedResult.invalidShotIndexes,
        invalidShotErrors: salvagedResult.invalidShotErrors,
      };
    }

    return {
      textContent: fallbackTextContent,
      shots: inferredShots,
      parseError,
      parseFallbackMode: inferredShots.length > 0 ? 'text-derived' : null,
    };
  }
}

function salvageStoryboardShots(
  jsonSource: string,
  inferredShots: StoryboardShot[]
): { shots: StoryboardShot[]; invalidShotIndexes: number[]; invalidShotErrors: string[] } | null {
  const parseCandidates = Array.from(
    new Set(
      [jsonSource, repairStoryboardJsonSource(jsonSource)]
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0)
    )
  );

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const normalizedShots = resolveStoryboardShotCollection(parsed);
      if (!normalizedShots || normalizedShots.length === 0) {
        continue;
      }

      const salvagedShots: StoryboardShot[] = [];
      const invalidShotIndexes: number[] = [];
      const invalidShotErrors: string[] = [];
      for (const [index, entry] of normalizedShots.entries()) {
        try {
          salvagedShots.push(validateStoryboardShot(entry, index));
        } catch (error) {
          invalidShotIndexes.push(index);
          invalidShotErrors.push(error instanceof Error ? error.message : `STORYBOARD_SHOT_INVALID:${index}`);
          const inferredShot = inferredShots[index];
          if (inferredShot) {
            salvagedShots.push(inferredShot);
          }
        }
      }

      if (salvagedShots.length > 0) {
        return { shots: salvagedShots, invalidShotIndexes, invalidShotErrors };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractStoryboardJsonBlock(
  trimmedContent: string
): { textContent: string; jsonSource: string } | null {
  const taggedMatches = Array.from(trimmedContent.matchAll(STORYBOARD_JSON_BLOCK_PATTERN));
  const taggedMatch = taggedMatches.at(-1);
  if (taggedMatch && taggedMatch.index !== undefined) {
    return {
      textContent: trimmedContent.slice(0, taggedMatch.index).trim(),
      jsonSource: sanitizeStoryboardJsonSource(taggedMatch[1] ?? taggedMatch[2] ?? ''),
    };
  }

  const jsonFenceMatches = Array.from(trimmedContent.matchAll(STORYBOARD_JSON_FENCE_PATTERN));
  const lastJsonFenceMatch = jsonFenceMatches.at(-1);
  if (!lastJsonFenceMatch || lastJsonFenceMatch.index === undefined) {
    const genericFenceMatches = Array.from(trimmedContent.matchAll(STORYBOARD_GENERIC_FENCE_PATTERN));
    const genericFenceMatch = [...genericFenceMatches]
      .reverse()
      .find((match) => match.index !== undefined && looksLikeStoryboardJsonCandidate(match[1] ?? ''));
    if (!genericFenceMatch || genericFenceMatch.index === undefined) {
      return null;
    }

    return {
      textContent: trimmedContent.slice(0, genericFenceMatch.index).trim(),
      jsonSource: sanitizeStoryboardJsonSource(genericFenceMatch[1] ?? ''),
    };
  }

  return {
    textContent: trimmedContent.slice(0, lastJsonFenceMatch.index).trim(),
    jsonSource: sanitizeStoryboardJsonSource(lastJsonFenceMatch[1] ?? ''),
  };
}

function stripStoryboardStructuredTail(fullContent: string): string {
  const trimmedContent = fullContent.trim();
  const taggedMatch = Array.from(trimmedContent.matchAll(STORYBOARD_JSON_BLOCK_PATTERN)).at(-1);
  if (taggedMatch && taggedMatch.index !== undefined) {
    return trimmedContent.slice(0, taggedMatch.index).trim();
  }

  const jsonFenceMatches = Array.from(trimmedContent.matchAll(STORYBOARD_JSON_FENCE_PATTERN));
  const lastJsonFenceMatch = jsonFenceMatches.at(-1);
  if (lastJsonFenceMatch && lastJsonFenceMatch.index !== undefined) {
    return trimmedContent.slice(0, lastJsonFenceMatch.index).trim();
  }

  const genericFenceMatches = Array.from(trimmedContent.matchAll(STORYBOARD_GENERIC_FENCE_PATTERN));
  const genericFenceMatch = [...genericFenceMatches]
    .reverse()
    .find((match) => match.index !== undefined && looksLikeStoryboardJsonCandidate(match[1] ?? ''));
  if (genericFenceMatch && genericFenceMatch.index !== undefined) {
    return trimmedContent.slice(0, genericFenceMatch.index).trim();
  }

  return trimmedContent;
}

function looksLikeStoryboardJsonCandidate(source: string): boolean {
  const normalized = sanitizeStoryboardJsonSource(source);
  if (!/^[\[{]/.test(normalized)) {
    return false;
  }

  return /sceneId|shotId|shots|storyboard/i.test(normalized);
}

function inferStoryboardShotsFromText(textContent: string): StoryboardShot[] {
  const sections = splitStoryboardTextSections(textContent);
  const inferredShots: StoryboardShot[] = [];

  for (const [sectionIndex, section] of sections.entries()) {
    const shotBlocks = Array.from(section.content.matchAll(STORYBOARD_SHOT_BLOCK_PATTERN));
    for (const [shotIndex, shotBlock] of shotBlocks.entries()) {
      const blockText = shotBlock[1]?.trim();
      if (!blockText) {
        continue;
      }

      inferredShots.push(
        buildInferredStoryboardShot(
          blockText,
          section.sceneName ?? `场景 ${sectionIndex + 1}`,
          sectionIndex,
          shotIndex
        )
      );
    }
  }

  return inferredShots;
}

function splitStoryboardTextSections(textContent: string): Array<{ sceneName: string | null; content: string }> {
  const lines = textContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const sections: Array<{ sceneName: string | null; content: string }> = [];
  let currentSceneName: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (!content) {
      return;
    }

    sections.push({
      sceneName: currentSceneName,
      content,
    });
    buffer = [];
  };

  for (const line of lines) {
    const sceneMatch = line.match(/^场景[:：]\s*(.+)$/);
    if (sceneMatch) {
      flush();
      currentSceneName = sceneMatch[1]?.trim() ?? null;
      continue;
    }

    buffer.push(line);
  }

  flush();

  return sections.length > 0 ? sections : [{ sceneName: null, content: textContent }];
}

function buildInferredStoryboardShot(
  blockText: string,
  fallbackSceneName: string,
  sectionIndex: number,
  shotIndex: number
): StoryboardShot {
  const compactBlock = blockText.replace(/\s+/g, ' ').trim();
  const subjects = Array.from(
    new Set(
      Array.from(compactBlock.matchAll(/🧑\s*([^\s，。-]+)-基础形象-基础形象/g))
        .map((match) => match[1]?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
  const sceneId = `S${String(sectionIndex + 1).padStart(2, '0')}`;
  const shotId = `${sceneId}-SH${String(shotIndex + 1).padStart(2, '0')}`;
  const environment =
    readLabeledClause(compactBlock, '场景图片：🖼️')?.replace(/_0\b/g, '').trim() ?? fallbackSceneName;
  const lensClauses = splitClauseList(readLabeledClause(compactBlock, '镜头：'));
  const shotType = lensClauses[0] ?? inferShotType(compactBlock);
  const camera = lensClauses.slice(1).join('，') || inferCameraMotion(compactBlock);
  const subject = subjects.length > 0 ? subjects.join('、') : inferSubject(compactBlock);
  const motion = inferShotMotion(compactBlock, subject);
  const lighting = inferLighting(compactBlock);
  const audioHint = inferAudioHint(compactBlock);
  const composition = inferComposition(shotType, subjects.length);

  return {
    sceneId,
    shotId,
    shotType,
    camera,
    composition,
    motion,
    subject,
    environment,
    lighting,
    audioHint,
    videoPrompt: [environment, shotType, camera, subject, motion, lighting, audioHint]
      .filter(Boolean)
      .join('，'),
  };
}

function readLabeledClause(text: string, label: string): string | null {
  const index = text.indexOf(label);
  if (index < 0) {
    return null;
  }

  const rest = text.slice(index + label.length);
  const endIndex = rest.search(/(?:，🧑|，背景[:：]|，音色[:：]|。|$)/);
  const clause = (endIndex >= 0 ? rest.slice(0, endIndex) : rest).trim();
  return clause || null;
}

function splitClauseList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split('，')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function inferShotType(text: string): string {
  return text.match(/(远景|全景|中景|近景|特写|过肩镜头)/)?.[1] ?? '中景';
}

function inferCameraMotion(text: string): string {
  const keywords = ['缓慢推进', '快速推进', '固定机位', '平移', '跟拍', '拉远', '仰拍', '俯拍', '环绕拍摄'];
  return keywords.find((keyword) => text.includes(keyword)) ?? '镜头轻微推进';
}

function inferSubject(text: string): string {
  return text.match(/([^\s，。：]+)\s*说[:：]/)?.[1] ?? '主要角色';
}

function inferShotMotion(text: string, subject: string): string {
  const cleaned = text
    .replace(/^(?:分镜|镜头|Shot)\s*[#:：]?\s*[A-Za-z①②③④⑤⑥⑦⑧⑨⑩\d]+\s*\d*s?[:：]?\s*/iu, '')
    .replace(/场景图片：🖼️[^\s，。]+/g, '')
    .replace(/镜头：[^。]+?(?=，🧑|，背景[:：]|，音色[:：]|。|$)/g, '')
    .replace(/🧑\s*[^\s，。-]+-基础形象-基础形象/g, '')
    .replace(/说：「[^」]*」/g, '')
    .replace(/音色[:：][^。]+/g, '')
    .replace(/背景[:：][^。]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[，。\s]+|[，。\s]+$/g, '');

  return cleaned || `${subject}执行关键动作`;
}

function inferLighting(text: string): string {
  if (text.includes('月光') || text.includes('冷色')) {
    return '冷色月光与环境补光';
  }

  if (text.includes('暖光') || text.includes('烛光') || text.includes('暖色')) {
    return '暖色环境光';
  }

  if (text.includes('金光') || text.includes('强光')) {
    return '高对比能量光效';
  }

  return '场景氛围光';
}

function inferAudioHint(text: string): string {
  return text.match(/背景[:：]([^。]+)/)?.[1]?.trim() ?? (text.includes('说：「') ? '人物对白与环境氛围音' : '环境氛围音');
}

function inferComposition(shotType: string, subjectCount: number): string {
  if (subjectCount > 1) {
    return '多人关系构图';
  }

  return shotType.includes('特写') ? '主体特写构图' : '单人主体构图';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export interface StoryboardScriptSourceResolution {
  scriptText: string;
  sourceScriptArtifactIds: string[];
}

export async function resolveStoryboardScriptSource(
  body: StoryboardGenerateRequestV2,
  scope?: {
    organizationId?: string | null;
    workspaceId?: string | null;
    projectId?: string | null;
  }
): Promise<StoryboardScriptSourceResolution> {
  const sourceScope = normalizeStoryboardScope(body.scope);
  const selection = normalizeStoryboardSelection(body.selection);
  const requestedArtifactIds = normalizeStoryboardArtifactIds(body.scriptArtifactIds);
  const initialArtifactIds =
    sourceScope === 'selection' && selection.artifactIds.length > 0
      ? selection.artifactIds
      : requestedArtifactIds;

  if (initialArtifactIds.length === 0) {
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
    initialArtifactIds.map(async (artifactId) => {
      const artifact = await runtime.generationArtifacts.getById(artifactId);
      if (!artifact) {
        throw new Error(`SCRIPT_ARTIFACT_NOT_FOUND:${artifactId}`);
      }

      if (artifact.kind !== 'script') {
        throw new Error(`SCRIPT_ARTIFACT_KIND_INVALID:${artifactId}`);
      }

      if (
        scope?.organizationId &&
        scope?.workspaceId &&
        !artifactBelongsToScope(artifact, {
          organizationId: scope.organizationId,
          workspaceId: scope.workspaceId,
        })
      ) {
        throw new Error(`SCRIPT_ARTIFACT_SCOPE_INVALID:${artifactId}`);
      }

      if (scope?.projectId && artifact.projectId !== scope.projectId) {
        throw new Error(`SCRIPT_ARTIFACT_PROJECT_INVALID:${artifactId}`);
      }

      return artifact;
    })
  );

  const filteredArtifacts =
    sourceScope === 'selection'
      ? applyStoryboardArtifactSelection(artifacts, selection)
      : artifacts;

  const resolvedArtifacts = filteredArtifacts
    .map((artifact) => {
      const filteredContent =
        sourceScope === 'selection'
          ? filterArtifactContentBySelection(artifact.content ?? '', selection)
          : artifact.content?.trim() ?? '';

      if (sourceScope !== 'selection' && !filteredContent) {
        throw new Error(`SCRIPT_ARTIFACT_EMPTY:${artifact.id}`);
      }

      if (!filteredContent) {
        return null;
      }

      return {
        artifactId: artifact.id,
        content: filteredContent,
      };
    })
    .filter((entry): entry is { artifactId: string; content: string } => entry !== null);

  if (resolvedArtifacts.length === 0) {
    if (sourceScope === 'selection') {
      throw new Error('SCRIPT_SELECTION_EMPTY');
    }

    throw new Error(`SCRIPT_ARTIFACT_EMPTY:${initialArtifactIds[0]}`);
  }

  const scriptText = resolvedArtifacts.map((artifact) => artifact.content).join('\n\n');
  const sourceScriptArtifactIds = resolvedArtifacts.map((artifact) => artifact.artifactId);

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

export function softenSensitiveContent(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/(强奸|性侵|猥亵|迷奸|轮奸)/gi, '强迫伤害'],
    [/(性交|做爱|性爱|床戏|上床|裸露|赤裸|下体|乳房|呻吟)/gi, '亲密行为'],
    [/(杀人|捅死|砍死|爆头|割喉|血肉模糊|尸体|碎尸)/gi, '激烈冲突'],
    [/(自杀|跳楼|割腕|上吊)/gi, '危险场面'],
    [/(吸毒|贩毒|毒品)/gi, '违禁物品'],
    [/(追杀|追捕|追缉|围剿|屠杀|灭口)/gi, '紧张追逐'],
    [/(战场|战事|大战|厮杀|交战|大军|兵卫|士兵|军队|兵马)/gi, '阵营对峙'],
    [/(兵器|刀剑|长枪|弓弩|火器|炸药|爆炸)/gi, '紧张道具'],
    [/(审问|拷打|刑讯|逼供|威胁)/gi, '强势施压'],
    [/(黑市|地下交易|走私|违禁交易)/gi, '灰色交易传闻'],
    [/(封印失控|错误触发|崩塌|坍塌|毁灭|覆灭)/gi, '局势失衡'],
    [/(夺走|掠夺|绑走|囚禁)/gi, '强行带离'],
    [/(民乱|暴动|叛乱)/gi, '局势动荡'],
    [/(鲜血|流血|血迹|血腥)/gi, '危险痕迹'],
  ];

  const softened = replacements.reduce((result, [pattern, replacement]) => {
    return result.replace(pattern, replacement);
  }, text);

  return softened
    .replace(/(详细|清楚|完整)描述(伤害|违法|危险)(过程|细节)/gi, '描述场面张力')
    .replace(/如何(伤害|报复|复仇|逃脱)/gi, '如何应对当前局面')
    .replace(/(立刻|马上)?处死/gi, '立刻处置')
    .replace(/见血封喉/gi, '迅速压制局面');
}

function buildSafeStoryboardRetrySource(
  scriptText: string,
  characters: string[],
  scenes: string[]
): string {
  const normalizedCharacters = normalizeSafeStoryboardCharacters(characters);
  const normalizedScenes = collectSafeStoryboardScenes(scriptText, scenes);
  const lines = scriptText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const dialogueLines = lines
    .filter((line) => /[:：]/.test(line))
    .slice(0, 18)
    .map((line, index) => {
      const separatorIndex = Math.max(line.indexOf('：'), line.indexOf(':'));
      const rawSpeaker = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : `角色${index + 1}`;
      const speaker = normalizeSafeStoryboardCharacter(rawSpeaker, index);
      const content = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
      return `台词${index + 1}：${speaker}表达“${normalizeSafeStoryboardSentence(content, 32)}”`;
    });

  const stageLines = lines
    .filter((line) => !/[:：]/.test(line))
    .slice(0, 12)
    .map((line, index) => `动作${index + 1}：${normalizeSafeStoryboardSentence(line, 40)}`);

  const sceneSummaries = (normalizedScenes.length > 0 ? normalizedScenes : ['主要场景'])
    .slice(0, 8)
    .map(
      (scene, index) =>
        `场景${index + 1}：${normalizeSafeStoryboardSentence(scene, 24)}。镜头重点：人物交流、表情变化、局势张力、空间调度。`
    );

  return [
    '以下内容为安全影视化摘要，请仅依据这些摘要生成分镜。',
    `角色：${normalizedCharacters.length > 0 ? normalizedCharacters.join('、') : '核心角色群像'}`,
    ...sceneSummaries,
    ...(dialogueLines.length > 0 ? dialogueLines : ['台词重点：角色围绕当前局势展开克制交流。']),
    ...(stageLines.length > 0 ? stageLines : ['动作重点：以人物出场、停顿、对视、转身、推进镜头为主。']),
    '统一要求：突出悬念感、调查感、关系张力与镜头运动，不描写伤害细节、违法过程或危险后果。',
  ].join('\n');
}

function normalizeSafeStoryboardSentence(text: string, maxLength: number): string {
  const softened = softenSensitiveContent(text)
    .replace(/[「」"'`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\p{Script=Han}，。？！、：:（）()《》\- ]/gu, '')
    .trim();

  if (softened.length <= maxLength) {
    return softened;
  }

  return `${softened.slice(0, maxLength)}...`;
}

function buildLocalSafeStoryboardOutput(input: {
  scriptText: string;
  characters: string[];
  scenes: string[];
  visualStyle: string;
  colorTone: string;
  genreLabel: string;
}): string {
  const shots = buildLocalSafeStoryboardShots(input);
  const groupedByScene = new Map<string, StoryboardShot[]>();

  for (const shot of shots) {
    const sceneShots = groupedByScene.get(shot.sceneId) ?? [];
    sceneShots.push(shot);
    groupedByScene.set(shot.sceneId, sceneShots);
  }

  const textBlocks = Array.from(groupedByScene.entries()).flatMap(([, sceneShots]) => {
    const sceneName = sceneShots[0]?.environment ?? '主要场景';
    const blocks = [`场景: ${sceneName}`];
    sceneShots.forEach((shot, index) => {
      blocks.push(
        `分镜${toChineseIndex(index + 1)} 4s：时间：氛围镜头，场景图片：🖼️${sceneName}_0，镜头：${shot.shotType}，${shot.camera}，🧑 ${shot.subject}-基础形象-基础形象 ${shot.motion}，背景：${shot.audioHint}。${shot.camera}。`
      );
    });
    return blocks;
  });

  return `${textBlocks.join('\n\n')}\n\n[SHOTS_JSON]\n\`\`\`json\n${JSON.stringify(shots, null, 2)}\n\`\`\``;
}

function buildLocalSafeStoryboardShots(input: {
  scriptText: string;
  characters: string[];
  scenes: string[];
  visualStyle: string;
  colorTone: string;
  genreLabel: string;
}): StoryboardShot[] {
  const scenes = collectSafeStoryboardScenes(input.scriptText, input.scenes).slice(0, 4);
  const characters = normalizeSafeStoryboardCharacters(input.characters);
  const shots: StoryboardShot[] = [];

  (scenes.length > 0 ? scenes : ['主要场景']).forEach((scene, sceneIndex) => {
    const sceneId = `S${String(sceneIndex + 1).padStart(2, '0')}`;
    const primarySubject = characters[sceneIndex % characters.length] ?? '角色A';
    const secondarySubject = characters[(sceneIndex + 1) % characters.length] ?? primarySubject;
    const environment = normalizeSafeStoryboardSentence(scene, 20) || '主要场景';
    const atmosphere = `${input.visualStyle}，${input.colorTone}，${input.genreLabel}`;

    shots.push({
      sceneId,
      shotId: `${sceneId}-SH01`,
      shotType: '中景',
      camera: '缓慢推进',
      composition: '单人主体构图',
      motion: `${primarySubject}观察周围并整理情绪`,
      subject: primarySubject,
      environment,
      lighting: `克制光影，${atmosphere}`,
      audioHint: '环境音压低，保留风声与脚步声',
      videoPrompt: `${environment}，中景，缓慢推进，${primarySubject}观察周围并整理情绪，克制光影，环境音压低`,
    });

    shots.push({
      sceneId,
      shotId: `${sceneId}-SH02`,
      shotType: '近景',
      camera: '固定机位',
      composition: '双人对角构图',
      motion: `${primarySubject}与${secondarySubject}交换眼神，局势保持紧张`,
      subject: primarySubject === secondarySubject ? primarySubject : `${primarySubject}、${secondarySubject}`,
      environment,
      lighting: `人物面部补光，${atmosphere}`,
      audioHint: '对话压低处理，突出停顿与呼吸',
      videoPrompt: `${environment}，近景，固定机位，${primarySubject}与${secondarySubject}交换眼神，人物面部补光，对话压低处理`,
    });
  });

  return shots;
}

function toChineseIndex(index: number): string {
  return ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'][index - 1] ?? String(index);
}

function normalizeSafeStoryboardCharacters(characters: string[]): string[] {
  const normalized = characters
    .map((character, index) => normalizeSafeStoryboardCharacter(character, index))
    .filter((character, index, values) => values.indexOf(character) === index);

  return normalized.length > 0 ? normalized : ['角色A', '角色B'];
}

function normalizeSafeStoryboardCharacter(value: string, index: number): string {
  const cleaned = value
    .replace(/[^\p{L}\p{N}\p{Script=Han}]/gu, '')
    .trim();

  if (
    cleaned.length < 2 ||
    cleaned.length > 6 ||
    /^(\d+|[A-Za-z]+)$/.test(cleaned) ||
    /^([一二三四五六七八九十]+|[甲乙丙丁戊己庚辛壬癸])$/.test(cleaned)
  ) {
    return `角色${String.fromCharCode(65 + index)}`;
  }

  return cleaned;
}

function collectSafeStoryboardScenes(scriptText: string, scenes: string[]): string[] {
  const explicitScenes = scenes
    .map((scene) => normalizeSceneLabel(scene))
    .filter((scene): scene is string => Boolean(scene));

  if (explicitScenes.length > 0) {
    return explicitScenes;
  }

  const lines = scriptText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const derivedScenes: string[] = [];
  for (const line of lines) {
    const sceneMatch =
      line.match(/^\d+-\d+\s+(?:日|夜|晨|暮|黄昏)\s*(?:内|外|内外)\s*(.+)$/) ??
      line.match(/^场景[:：]\s*(.+)$/);
    if (!sceneMatch) {
      continue;
    }

    const normalized = normalizeSceneLabel(sceneMatch[1] ?? '');
    if (normalized && !derivedScenes.includes(normalized)) {
      derivedScenes.push(normalized);
    }
  }

  return derivedScenes;
}

function normalizeSceneLabel(value: string): string | null {
  const cleaned = value
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[^\p{L}\p{N}\p{Script=Han}\-、，。 ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return null;
  }

  if (/[:：]/.test(cleaned) || /[「」]/.test(cleaned)) {
    return null;
  }

  return cleaned.length > 18 ? `${cleaned.slice(0, 18)}...` : cleaned;
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

function normalizeStoryboardScope(scope: StoryboardGenerateRequestV2['scope'] | null | undefined) {
  return scope === 'selection' ? 'selection' : 'all';
}

interface NormalizedStoryboardSelection {
  artifactIds: string[];
  episodeNumbers: number[];
  sceneIds: string[];
}

function normalizeStoryboardSelection(
  selection: StoryboardGenerateRequestV2['selection'] | null | undefined
): NormalizedStoryboardSelection {
  const artifactIds = normalizeStoryboardArtifactIds(selection?.artifactIds);
  const episodeNumbers = Array.isArray(selection?.episodeNumbers)
    ? Array.from(
        new Set(
          selection.episodeNumbers.filter(
            (episodeNumber): episodeNumber is number =>
              Number.isInteger(episodeNumber) && episodeNumber > 0
          )
        )
      )
    : [];
  const sceneIds = Array.isArray(selection?.sceneIds)
    ? Array.from(
        new Set(
          selection.sceneIds
            .map((sceneId) => sceneId.trim())
            .filter((sceneId) => sceneId.length > 0)
        )
      )
    : [];

  return {
    artifactIds,
    episodeNumbers,
    sceneIds,
  };
}

function hasStoryboardSelectionCriteria(selection: NormalizedStoryboardSelection): boolean {
  return (
    selection.artifactIds.length > 0 ||
    selection.episodeNumbers.length > 0 ||
    selection.sceneIds.length > 0
  );
}

function applyStoryboardArtifactSelection<
  TArtifact extends { id: string; metadata?: Record<string, unknown> | null }
>(artifacts: TArtifact[], selection: NormalizedStoryboardSelection): TArtifact[] {
  let filteredArtifacts = artifacts;

  if (selection.episodeNumbers.length > 0) {
    const allowedEpisodes = new Set(selection.episodeNumbers);
    filteredArtifacts = filteredArtifacts.filter((artifact) => {
      const episodeValue = artifact.metadata?.episode;
      return typeof episodeValue === 'number' && allowedEpisodes.has(episodeValue);
    });
  }

  return filteredArtifacts;
}

function filterArtifactContentBySelection(
  content: string,
  selection: NormalizedStoryboardSelection
): string {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return '';
  }

  if (selection.sceneIds.length === 0) {
    return trimmedContent;
  }

  const sceneBlocks = splitScriptIntoSceneBlocks(trimmedContent);
  const allowedSceneIds = new Set(selection.sceneIds.map((sceneId) => sceneId.toLowerCase()));
  const filteredBlocks = sceneBlocks.filter((block) =>
    storyboardSceneBlockMatchesSelection(block, allowedSceneIds)
  );

  return filteredBlocks.join('\n\n').trim();
}

function splitScriptIntoSceneBlocks(content: string): string[] {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return [];
  }

  const sceneHeadingPattern = /^\s*\d+-\d+\s+(?:日|夜|晨|暮|黄昏)\s*(?:内|外|内外)\s*.+$/gm;
  const matches = Array.from(normalizedContent.matchAll(sceneHeadingPattern));

  if (matches.length === 0) {
    return [normalizedContent];
  }

  return matches.map((match, index) => {
    const startIndex = match.index ?? 0;
    const endIndex =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? normalizedContent.length)
        : normalizedContent.length;
    return normalizedContent.slice(startIndex, endIndex).trim();
  });
}

function storyboardSceneBlockMatchesSelection(
  block: string,
  allowedSceneIds: Set<string>
): boolean {
  const firstLine = block.split(/\r?\n/, 1)[0]?.trim() ?? '';
  if (!firstLine) {
    return false;
  }

  const normalizedHeading = firstLine.toLowerCase();
  const sceneIdMatch = firstLine.match(/^(\d+-\d+)/);
  const normalizedSceneId = sceneIdMatch?.[1]?.toLowerCase() ?? '';

  for (const allowedSceneId of allowedSceneIds) {
    if (allowedSceneId === normalizedSceneId || normalizedHeading.includes(allowedSceneId)) {
      return true;
    }
  }

  return false;
}

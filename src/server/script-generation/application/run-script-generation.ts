import { cleanText, truncateTextForLLM } from '@/lib/preprocessor';
import { analyzeNovel, generateOutline, generateScript } from '@/lib/llm';
import { parseJsonLike } from '@/lib/json-parser';
import { delay } from '@/lib/timing';
import { type NovelAnalysis, type OutlineEntry } from '@/lib/types';
import {
  type ScriptGenerationRequest,
} from '@/features/script-generation/contracts';
import { withProgressHeartbeat } from '@/server/generation/progress-heartbeat';
import { buildStoryChunks } from '@/server/story-engine/chunking';
import { evaluateStoryComplexity } from '@/server/story-engine/complexity';
import { buildSceneCards, buildStoryBible } from '@/server/story-engine/story-bible';
import {
  buildScriptUsageEvent,
  type ScriptGenerationExecutionOptions,
  type ScriptGenerationProgressUpdate,
} from './types';

export function getScriptGenerationRequestError(
  body: Partial<ScriptGenerationRequest> | null | undefined
): string | null {
  if (
    typeof body?.text !== 'string' ||
    !body.text.trim() ||
    typeof body.genre !== 'string' ||
    !body.config
  ) {
    return '缺少必要参数';
  }

  if (
    typeof body.config.episodeCount !== 'number' ||
    body.config.episodeCount < 1 ||
    typeof body.config.episodeDuration !== 'string' ||
    typeof body.config.style !== 'string'
  ) {
    return '缺少生成配置';
  }

  return null;
}

export async function runScriptGeneration(
  {
    body,
    context,
    jobId,
    send,
    llmConfig,
    usageMeter,
    onProgress,
    onArtifact,
  }: ScriptGenerationExecutionOptions
): Promise<void> {
  const maxAnalysisChars = Number(process.env.NOVELSCRIPT_ANALYSIS_MAX_CHARS ?? '5000');
  const maxAnalysisBytes = Number(process.env.NOVELSCRIPT_ANALYSIS_MAX_BYTES ?? '18000');

  usageMeter?.record(
    buildScriptUsageEvent(context, body.text.length, 'character', {
      phase: 'request_received',
      episodeCount: body.config.episodeCount,
      jobId,
    })
  );
  usageMeter?.record(
    buildScriptUsageEvent(context, 1, 'job', {
      phase: 'job_started',
      jobId,
    })
  );

  send({ step: 'preprocessing', message: '正在预处理文本...' });
  await onProgress?.({ progress: 5, currentStep: 'preprocessing' });
  const cleanedText = cleanText(body.text);
  const complexityInfo = body.complexityInfo ?? evaluateStoryComplexity(cleanedText);
  const executionMode = body.executionMode ?? complexityInfo.recommendedExecutionMode;
  const storyChunks = buildStoryChunks(cleanedText, complexityInfo);
  const textForAnalysis = truncateTextForLLM(cleanedText, {
    maxChars: Number.isFinite(maxAnalysisChars) ? maxAnalysisChars : 5000,
    maxBytes: Number.isFinite(maxAnalysisBytes) ? maxAnalysisBytes : 18000,
  });

  let analysisJson: string;
  let resolvedAnalysis: NovelAnalysis | null = body.analysis ?? null;
  let segmentedAnalyses: NovelAnalysis[] | null = null;
  if (body.analysis) {
    analysisJson = JSON.stringify(body.analysis);
    send({ step: 'analyzing', message: '使用已有分析结果...' });
    await onArtifact?.({
      kind: 'analysis',
      title: '小说分析',
      format: 'application/json',
      content: analysisJson,
      metadata: {
        reused: true,
        executionMode,
        complexityInfo,
        chunkCount: storyChunks.length,
        analysisStrategy: 'reused',
        analyzedChunkCount: 0,
      },
    });
    await onProgress?.({ progress: 30, currentStep: 'analyzed', outputSummary: 'reused analysis' });
  } else {
    const analysisExecution = executionMode === 'segmented' && storyChunks.length > 1
      ? await runSegmentedAnalysis({
          storyChunks,
          genre: body.genre,
          llmConfig,
          onProgress,
          send,
          fallbackText: textForAnalysis,
        })
      : await runSinglePassAnalysis({
          text: textForAnalysis,
          genre: body.genre,
          llmConfig,
          onProgress,
          send,
        });

    analysisJson = analysisExecution.analysisJson;
    resolvedAnalysis = analysisExecution.resolvedAnalysis;
    segmentedAnalyses = analysisExecution.chunkAnalyses ?? null;
    send({
      step: 'analyzed',
      message: analysisExecution.message,
      data: analysisJson,
      parseError: analysisExecution.parseError,
    });
    await onArtifact?.({
      kind: 'analysis',
      title: '小说分析',
      format: 'application/json',
      content: analysisJson,
      metadata: {
        parseError: analysisExecution.parseError,
        executionMode,
        complexityInfo,
        chunkCount: storyChunks.length,
        analysisStrategy: analysisExecution.strategy,
        analyzedChunkCount: analysisExecution.analyzedChunkCount,
      },
    });
    await onProgress?.({ progress: 30, currentStep: 'analyzed', outputSummary: 'analysis ready' });
  }

  if (resolvedAnalysis) {
    const storyBible = buildStoryBible({
      analysis: resolvedAnalysis,
      style: body.config.style,
    });

    await onArtifact?.({
      kind: 'story_bible',
      title: '故事圣经',
      format: 'application/json',
      content: JSON.stringify(storyBible, null, 2),
      metadata: {
        sourceKind: 'analysis',
        characterCount: storyBible.characters.length,
        executionMode,
        complexityInfo,
      },
    });
  }

  send({ step: 'outlining', message: '正在生成分集大纲...' });
  await onProgress?.({ progress: 40, currentStep: 'outlining' });
  const outlineExecution = executionMode === 'segmented' && segmentedAnalyses && segmentedAnalyses.length > 1
    ? await runSegmentedOutline({
        segmentedAnalyses,
        genre: body.genre,
        episodeCount: body.config.episodeCount,
        llmConfig,
        onProgress,
        send,
        fallbackAnalysisJson: analysisJson,
      })
    : await runSinglePassOutline({
        analysisJson,
        genre: body.genre,
        episodeCount: body.config.episodeCount,
        llmConfig,
        onProgress,
        send,
      });
  const outlineJson = outlineExecution.outlineJson;
  send({
    step: 'outlined',
    message: outlineExecution.message,
    data: outlineJson,
    parseError: outlineExecution.parseError,
  });
  await onArtifact?.({
    kind: 'outline',
    title: '分集大纲',
    format: 'application/json',
    content: outlineJson,
    metadata: {
      parseError: outlineExecution.parseError,
      executionMode,
      complexityInfo,
      chunkCount: storyChunks.length,
      outlineStrategy: outlineExecution.strategy,
      outlinedChunkCount: outlineExecution.outlinedChunkCount,
    },
  });

  if (resolvedAnalysis && outlineExecution.outlineEntries) {
    const sceneCards = buildSceneCards({
      analysis: resolvedAnalysis,
      outline: outlineExecution.outlineEntries,
    });

    await onArtifact?.({
      kind: 'scene_cards',
      title: '场景卡',
      format: 'application/json',
      content: JSON.stringify(sceneCards, null, 2),
      metadata: {
        sourceKind: 'outline',
        sceneCount: sceneCards.length,
        executionMode,
        complexityInfo,
      },
    });
  }

  await onProgress?.({ progress: 50, currentStep: 'outlined', outputSummary: 'outline ready' });

  const episodeCount = body.config.episodeCount;
  for (let episode = 1; episode <= episodeCount; episode += 1) {
    send({
      step: 'generating',
      message: `正在生成第 ${episode}/${episodeCount} 集剧本...`,
      episode,
    });
    await onProgress?.({
      progress: Math.min(95, 50 + (episode - 1) * (45 / episodeCount)),
      currentStep: `generating_episode_${episode}`,
      outputSummary: `episode ${episode}/${episodeCount}`,
    });

    let scriptContent = '';
    const segmentedChunkIndex = outlineExecution.episodeChunkMap?.[episode] ?? null;
    const segmentedChunkAnalysis =
      segmentedChunkIndex && segmentedAnalyses
        ? segmentedAnalyses[segmentedChunkIndex - 1] ?? null
        : null;
    const segmentedChunkOutlineEntries =
      segmentedChunkIndex && outlineExecution.perChunkOutlineEntries
        ? outlineExecution.perChunkOutlineEntries[segmentedChunkIndex - 1] ?? null
        : null;
    const episodeAnalysisJson = segmentedChunkAnalysis
      ? JSON.stringify(segmentedChunkAnalysis, null, 2)
      : analysisJson;
    const episodeOutlineJson = segmentedChunkOutlineEntries
      ? JSON.stringify(segmentedChunkOutlineEntries, null, 2)
      : outlineJson;
    const scriptStrategy =
      executionMode === 'segmented' &&
      outlineExecution.strategy === 'segmented' &&
      Boolean(segmentedChunkIndex)
        ? 'segmented'
        : 'single';
    await withProgressHeartbeat(
      {
        onProgress,
        progress: Math.min(95, 50 + (episode - 1) * (45 / episodeCount)),
        currentStep: `generating_episode_${episode}`,
        outputSummary: `episode ${episode}/${episodeCount}`,
      },
      async () => {
        for await (const chunk of generateScript(
          episodeOutlineJson,
          episodeAnalysisJson,
          body.genre,
          episode,
          {
            episodeDuration: body.config.episodeDuration,
            style: body.config.style,
          },
          llmConfig
        )) {
          scriptContent += chunk;
          send({
            step: 'streaming',
            episode,
            chunk,
            content: scriptContent,
          });
        }
      }
    );

    send({
      step: 'episode_done',
      episode,
      content: scriptContent,
    });
    await onArtifact?.({
      kind: 'script',
      title: `第${episode}集剧本`,
      format: 'text/plain',
      content: scriptContent,
      metadata: {
        episode,
        executionMode,
        complexityInfo,
        chunkCount: storyChunks.length,
        scriptStrategy,
        sourceChunkIndex: segmentedChunkIndex,
      },
    });

    if (episode < episodeCount) {
      await delay(500);
    }
  }

  usageMeter?.record(
    buildScriptUsageEvent(context, 1, 'request', {
      phase: 'job_completed',
      episodeCount,
      jobId,
    })
  );
  await onProgress?.({ progress: 100, currentStep: 'done', outputSummary: `Generated ${episodeCount} episodes` });
  send({ step: 'done', message: '全部剧本生成完成！' });
}

interface AnalysisExecutionResult {
  analysisJson: string;
  resolvedAnalysis: NovelAnalysis | null;
  chunkAnalyses?: NovelAnalysis[];
  parseError: string | null;
  message: string;
  strategy: 'reused' | 'single' | 'segmented' | 'segmented_fallback_single';
  analyzedChunkCount: number;
}

interface OutlineExecutionResult {
  outlineJson: string;
  outlineEntries: OutlineEntry[] | null;
  perChunkOutlineEntries?: OutlineEntry[][];
  episodeChunkMap?: Record<number, number>;
  parseError: string | null;
  message: string;
  strategy: 'single' | 'segmented' | 'segmented_fallback_single';
  outlinedChunkCount: number;
}

async function runSinglePassAnalysis(input: {
  text: string;
  genre: ScriptGenerationRequest['genre'];
  llmConfig: ScriptGenerationExecutionOptions['llmConfig'];
  onProgress?: ScriptGenerationExecutionOptions['onProgress'];
  send: ScriptGenerationExecutionOptions['send'];
}): Promise<AnalysisExecutionResult> {
  input.send({
    step: 'analyzing',
    message: '正在分析小说内容（角色、情节、冲突点）...',
  });
  await input.onProgress?.({ progress: 15, currentStep: 'analyzing' });
  const analysisRaw = await withProgressHeartbeat(
    {
      onProgress: input.onProgress,
      progress: 15,
      currentStep: 'analyzing',
    },
    () => analyzeNovel(input.text, input.genre, input.llmConfig)
  );
  const analysisResult = parseJsonLike<NovelAnalysis>(analysisRaw);

  return {
    analysisJson: analysisResult.ok
      ? JSON.stringify(analysisResult.value, null, 2)
      : analysisRaw,
    resolvedAnalysis: analysisResult.ok ? analysisResult.value : null,
    chunkAnalyses: analysisResult.ok ? [analysisResult.value] : undefined,
    parseError: analysisResult.ok ? null : analysisResult.error,
    message: analysisResult.ok ? '分析完成' : '分析结果解析失败，已回传原始内容',
    strategy: 'single',
    analyzedChunkCount: 1,
  };
}

async function runSegmentedAnalysis(input: {
  storyChunks: ReturnType<typeof buildStoryChunks>;
  genre: ScriptGenerationRequest['genre'];
  llmConfig: ScriptGenerationExecutionOptions['llmConfig'];
  onProgress?: ScriptGenerationExecutionOptions['onProgress'];
  send: ScriptGenerationExecutionOptions['send'];
  fallbackText: string;
}): Promise<AnalysisExecutionResult> {
  const parsedChunkAnalyses: NovelAnalysis[] = [];

  for (const chunk of input.storyChunks) {
    const progress = calculateSegmentedProgress(chunk.index, input.storyChunks.length);
    input.send({
      step: 'analyzing',
      message: `正在分段分析小说内容（${chunk.index}/${input.storyChunks.length}）...`,
    });
    await input.onProgress?.({
      progress,
      currentStep: `analyzing_chunk_${chunk.index}`,
      outputSummary: `chunk ${chunk.index}/${input.storyChunks.length}`,
    });
    const analysisRaw = await withProgressHeartbeat(
      {
        onProgress: input.onProgress,
        progress,
        currentStep: `analyzing_chunk_${chunk.index}`,
        outputSummary: `chunk ${chunk.index}/${input.storyChunks.length}`,
      },
      () => analyzeNovel(chunk.text, input.genre, input.llmConfig)
    );
    const analysisResult = parseJsonLike<NovelAnalysis>(analysisRaw);
    if (!analysisResult.ok) {
      return runSinglePassFallback(input);
    }

    parsedChunkAnalyses.push(analysisResult.value);
  }

  const mergedAnalysis = mergeNovelAnalyses(parsedChunkAnalyses, input.genre);

  return {
    analysisJson: JSON.stringify(mergedAnalysis, null, 2),
    resolvedAnalysis: mergedAnalysis,
    chunkAnalyses: parsedChunkAnalyses,
    parseError: null,
    message: '分段分析完成',
    strategy: 'segmented',
    analyzedChunkCount: parsedChunkAnalyses.length,
  };
}

async function runSinglePassFallback(input: {
  genre: ScriptGenerationRequest['genre'];
  llmConfig: ScriptGenerationExecutionOptions['llmConfig'];
  onProgress?: ScriptGenerationExecutionOptions['onProgress'];
  send: ScriptGenerationExecutionOptions['send'];
  fallbackText: string;
}): Promise<AnalysisExecutionResult> {
  const fallback = await runSinglePassAnalysis({
    text: input.fallbackText,
    genre: input.genre,
    llmConfig: input.llmConfig,
    onProgress: input.onProgress,
    send: input.send,
  });

  return {
    ...fallback,
    strategy: 'segmented_fallback_single',
  };
}

async function runSinglePassOutline(input: {
  analysisJson: string;
  genre: ScriptGenerationRequest['genre'];
  episodeCount: number;
  llmConfig: ScriptGenerationExecutionOptions['llmConfig'];
  onProgress?: ScriptGenerationExecutionOptions['onProgress'];
  send: ScriptGenerationExecutionOptions['send'];
}): Promise<OutlineExecutionResult> {
  const outlineRaw = await withProgressHeartbeat(
    {
      onProgress: input.onProgress,
      progress: 40,
      currentStep: 'outlining',
    },
    () =>
      generateOutline(
        input.analysisJson,
        input.genre,
        input.episodeCount,
        input.llmConfig
      )
  );
  const outlineResult = parseJsonLike<OutlineEntry[]>(outlineRaw);

  return {
    outlineJson: outlineResult.ok ? JSON.stringify(outlineResult.value, null, 2) : outlineRaw,
    outlineEntries: outlineResult.ok ? outlineResult.value : null,
    parseError: outlineResult.ok ? null : outlineResult.error,
    message: outlineResult.ok ? '大纲生成完成' : '大纲解析失败，已回传原始内容',
    strategy: 'single',
    outlinedChunkCount: 1,
  };
}

async function runSegmentedOutline(input: {
  segmentedAnalyses: NovelAnalysis[];
  genre: ScriptGenerationRequest['genre'];
  episodeCount: number;
  llmConfig: ScriptGenerationExecutionOptions['llmConfig'];
  onProgress?: ScriptGenerationExecutionOptions['onProgress'];
  send: ScriptGenerationExecutionOptions['send'];
  fallbackAnalysisJson: string;
}): Promise<OutlineExecutionResult> {
  const allocations = allocateEpisodesAcrossChunks(
    input.episodeCount,
    input.segmentedAnalyses.length
  );
  const mergedOutlineEntries: OutlineEntry[] = [];
  const perChunkOutlineEntries: OutlineEntry[][] = [];
  const episodeChunkMap: Record<number, number> = {};

  for (let index = 0; index < input.segmentedAnalyses.length; index += 1) {
    const allocatedEpisodes = allocations[index] ?? 0;
    if (allocatedEpisodes <= 0) {
      perChunkOutlineEntries.push([]);
      continue;
    }

    const progress = calculateSegmentedOutlineProgress(index + 1, input.segmentedAnalyses.length);
    input.send({
      step: 'outlining',
      message: `正在分段生成分集大纲（${index + 1}/${input.segmentedAnalyses.length}）...`,
    });
    await input.onProgress?.({
      progress,
      currentStep: `outlining_chunk_${index + 1}`,
      outputSummary: `outline chunk ${index + 1}/${input.segmentedAnalyses.length}`,
    });

    const outlineRaw = await withProgressHeartbeat(
      {
        onProgress: input.onProgress,
        progress,
        currentStep: `outlining_chunk_${index + 1}`,
        outputSummary: `outline chunk ${index + 1}/${input.segmentedAnalyses.length}`,
      },
      () =>
        generateOutline(
          JSON.stringify(input.segmentedAnalyses[index]),
          input.genre,
          allocatedEpisodes,
          input.llmConfig
        )
    );
    const outlineResult = parseJsonLike<OutlineEntry[]>(outlineRaw);
    if (!outlineResult.ok) {
      return runSinglePassOutlineFallback(input);
    }

    const episodeStart = mergedOutlineEntries.length;
    const normalizedChunkEntries = outlineResult.value.map((entry, entryIndex) => ({
        ...entry,
        episodeNumber: episodeStart + entryIndex + 1,
      }));
    for (const entry of normalizedChunkEntries) {
      episodeChunkMap[entry.episodeNumber] = index + 1;
    }
    perChunkOutlineEntries.push(normalizedChunkEntries);
    mergedOutlineEntries.push(...normalizedChunkEntries);
  }

  if (mergedOutlineEntries.length !== input.episodeCount) {
    return runSinglePassOutlineFallback(input);
  }

  return {
    outlineJson: JSON.stringify(mergedOutlineEntries, null, 2),
    outlineEntries: mergedOutlineEntries,
    perChunkOutlineEntries,
    episodeChunkMap,
    parseError: null,
    message: '分段大纲生成完成',
    strategy: 'segmented',
    outlinedChunkCount: input.segmentedAnalyses.length,
  };
}

async function runSinglePassOutlineFallback(input: {
  genre: ScriptGenerationRequest['genre'];
  episodeCount: number;
  llmConfig: ScriptGenerationExecutionOptions['llmConfig'];
  onProgress?: ScriptGenerationExecutionOptions['onProgress'];
  send: ScriptGenerationExecutionOptions['send'];
  fallbackAnalysisJson: string;
}): Promise<OutlineExecutionResult> {
  const fallback = await runSinglePassOutline({
    analysisJson: input.fallbackAnalysisJson,
    genre: input.genre,
    episodeCount: input.episodeCount,
    llmConfig: input.llmConfig,
    onProgress: input.onProgress,
    send: input.send,
  });

  return {
    ...fallback,
    strategy: 'segmented_fallback_single',
  };
}

function mergeNovelAnalyses(
  analyses: NovelAnalysis[],
  genre: ScriptGenerationRequest['genre']
): NovelAnalysis {
  const firstTitle = analyses.map((item) => item.title.trim()).find(Boolean) ?? '分段汇总故事';
  const characters = new Map<string, NovelAnalysis['characters'][number]>();

  for (const analysis of analyses) {
    for (const character of analysis.characters) {
      const existing = characters.get(character.name);
      if (existing) {
        characters.set(character.name, {
          ...existing,
          description: mergeSentences(existing.description, character.description),
          personality: mergeSentences(existing.personality, character.personality),
          speechStyle: mergeSentences(existing.speechStyle, character.speechStyle),
          relationships: dedupeStrings([...existing.relationships, ...character.relationships]),
        });
      } else {
        characters.set(character.name, {
          ...character,
          relationships: dedupeStrings(character.relationships),
        });
      }
    }
  }

  return {
    title: firstTitle,
    genre,
    characters: Array.from(characters.values()),
    plotSummary: analyses.map((item) => item.plotSummary.trim()).filter(Boolean).join('\n'),
    keyConflicts: dedupeStrings(analyses.flatMap((item) => item.keyConflicts)),
    climaxPoints: dedupeStrings(analyses.flatMap((item) => item.climaxPoints)),
    emotionalBeats: dedupeStrings(analyses.flatMap((item) => item.emotionalBeats)),
  };
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function mergeSentences(...values: string[]): string {
  return dedupeStrings(values).join('；');
}

function calculateSegmentedProgress(chunkIndex: number, totalChunks: number): number {
  if (totalChunks <= 1) {
    return 15;
  }

  const ratio = (chunkIndex - 1) / totalChunks;
  return Math.round(15 + ratio * 12);
}

function calculateSegmentedOutlineProgress(chunkIndex: number, totalChunks: number): number {
  if (totalChunks <= 1) {
    return 40;
  }

  const ratio = (chunkIndex - 1) / totalChunks;
  return Math.round(40 + ratio * 8);
}

function allocateEpisodesAcrossChunks(totalEpisodes: number, chunkCount: number): number[] {
  if (chunkCount <= 0) {
    return [];
  }

  const base = Math.floor(totalEpisodes / chunkCount);
  const remainder = totalEpisodes % chunkCount;

  return Array.from({ length: chunkCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

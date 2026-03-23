import { cleanText } from '@/lib/preprocessor';
import { analyzeNovel, generateOutline, generateScript } from '@/lib/llm';
import { parseJsonLike } from '@/lib/json-parser';
import { delay } from '@/lib/timing';
import { type NovelAnalysis, type OutlineEntry } from '@/lib/types';
import {
  type ScriptGenerationRequest,
} from '@/features/script-generation/contracts';
import { buildScriptUsageEvent, type ScriptGenerationExecutionOptions } from './types';

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
  const textForAnalysis = cleanedText.slice(0, 8000);

  let analysisJson: string;
  if (body.analysis) {
    analysisJson = JSON.stringify(body.analysis);
    send({ step: 'analyzing', message: '使用已有分析结果...' });
    await onArtifact?.({
      kind: 'analysis',
      title: '小说分析',
      format: 'application/json',
      content: analysisJson,
      metadata: { reused: true },
    });
    await onProgress?.({ progress: 30, currentStep: 'analyzed', outputSummary: 'reused analysis' });
  } else {
    send({
      step: 'analyzing',
      message: '正在分析小说内容（角色、情节、冲突点）...',
    });
    await onProgress?.({ progress: 15, currentStep: 'analyzing' });
    const analysisRaw = await analyzeNovel(textForAnalysis, body.genre, llmConfig);
    const analysisResult = parseJsonLike<NovelAnalysis>(analysisRaw);
    analysisJson = analysisResult.ok
      ? JSON.stringify(analysisResult.value, null, 2)
      : analysisRaw;
    send({
      step: 'analyzed',
      message: analysisResult.ok ? '分析完成' : '分析结果解析失败，已回传原始内容',
      data: analysisJson,
      parseError: analysisResult.ok ? null : analysisResult.error,
    });
    await onArtifact?.({
      kind: 'analysis',
      title: '小说分析',
      format: 'application/json',
      content: analysisJson,
      metadata: { parseError: analysisResult.ok ? null : analysisResult.error },
    });
    await onProgress?.({ progress: 30, currentStep: 'analyzed', outputSummary: 'analysis ready' });
  }

  send({ step: 'outlining', message: '正在生成分集大纲...' });
  await onProgress?.({ progress: 40, currentStep: 'outlining' });
  const outlineRaw = await generateOutline(
    analysisJson,
    body.genre,
    body.config.episodeCount,
    llmConfig
  );
  const outlineResult = parseJsonLike<OutlineEntry[]>(outlineRaw);
  const outlineJson = outlineResult.ok
    ? JSON.stringify(outlineResult.value, null, 2)
    : outlineRaw;
  send({
    step: 'outlined',
    message: outlineResult.ok ? '大纲生成完成' : '大纲解析失败，已回传原始内容',
    data: outlineJson,
    parseError: outlineResult.ok ? null : outlineResult.error,
  });
  await onArtifact?.({
    kind: 'outline',
    title: '分集大纲',
    format: 'application/json',
    content: outlineJson,
    metadata: { parseError: outlineResult.ok ? null : outlineResult.error },
  });
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
    for await (const chunk of generateScript(
      outlineJson,
      analysisJson,
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
      metadata: { episode },
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

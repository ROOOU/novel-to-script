import { cleanText } from '@/lib/preprocessor';
import type { ComplexityInfo, ExecutionMode } from '@/lib/types';

export function evaluateStoryComplexity(rawText: string): ComplexityInfo {
  const text = cleanText(rawText);
  const estimatedSceneBreaks = countMatches(text, /(?:\n{2,}|场景|地点[:：]|INT\.|EXT\.|镜头切换)/g);
  const estimatedTimeJumps = countMatches(text, /(?:翌日|次日|多年后|几天后|夜里|清晨|傍晚|突然回到|回忆起|与此同时)/g);
  const estimatedPovSwitches = countMatches(text, /(?:另一边|与此同时|此时|另一处|视角切换|转到)/g);
  const estimatedCharacterDensity = estimateCharacterDensity(text);
  const textLength = text.length;

  const score =
    Math.min(100, Math.round(
      textLength / 220 +
      estimatedSceneBreaks * 6 +
      estimatedTimeJumps * 8 +
      estimatedPovSwitches * 7 +
      estimatedCharacterDensity * 5
    ));

  const recommendedExecutionMode: ExecutionMode =
    textLength > 8000 ||
    estimatedSceneBreaks >= 6 ||
    estimatedTimeJumps >= 2 ||
    estimatedPovSwitches >= 2 ||
    estimatedCharacterDensity >= 5
      ? 'segmented'
      : 'direct';

  const chunkCount =
    recommendedExecutionMode === 'segmented'
      ? Math.max(2, Math.ceil(textLength / 6000))
      : 1;

  return {
    score,
    textLength,
    estimatedSceneBreaks,
    estimatedTimeJumps,
    estimatedPovSwitches,
    estimatedCharacterDensity,
    recommendedExecutionMode,
    chunkCount,
  };
}

function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length;
}

function estimateCharacterDensity(text: string) {
  const candidates = Array.from(text.matchAll(/[\u4e00-\u9fff]{2,4}[：:]/g)).map((match) =>
    match[0].replace(/[：:]/g, '').trim()
  );

  return Array.from(new Set(candidates)).length;
}

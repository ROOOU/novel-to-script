import type { GenerationArtifact, SupportedLocale } from '@/server/shared/platform/domain';

export interface ScriptDiagnostics {
  executionMode: 'direct' | 'segmented';
  recommendedExecutionMode: 'direct' | 'segmented' | null;
  analysisStrategy: 'reused' | 'single' | 'segmented' | 'segmented_fallback_single' | null;
  outlineStrategy: 'single' | 'segmented' | 'segmented_fallback_single' | null;
  scriptStrategy: 'single' | 'segmented' | null;
  chunkCount: number;
  analyzedChunkCount: number;
  outlinedChunkCount: number;
  complexityScore: number | null;
  sourceChunkIndex: number | null;
}

type ScriptDiagnosticsMetadata = GenerationArtifact['metadata'] | undefined;

export function readScriptDiagnostics(metadata: GenerationArtifact['metadata'] | undefined) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const executionMode =
    metadata.executionMode === 'direct' || metadata.executionMode === 'segmented'
      ? metadata.executionMode
      : null;
  const chunkCount =
    typeof metadata.chunkCount === 'number' && Number.isFinite(metadata.chunkCount)
      ? metadata.chunkCount
      : null;
  const analyzedChunkCount =
    typeof metadata.analyzedChunkCount === 'number' && Number.isFinite(metadata.analyzedChunkCount)
      ? metadata.analyzedChunkCount
      : null;
  const analysisStrategy =
    metadata.analysisStrategy === 'reused' ||
    metadata.analysisStrategy === 'single' ||
    metadata.analysisStrategy === 'segmented' ||
    metadata.analysisStrategy === 'segmented_fallback_single'
      ? metadata.analysisStrategy
      : null;
  const outlineStrategy =
    metadata.outlineStrategy === 'single' ||
    metadata.outlineStrategy === 'segmented' ||
    metadata.outlineStrategy === 'segmented_fallback_single'
      ? metadata.outlineStrategy
      : null;
  const scriptStrategy =
    metadata.scriptStrategy === 'single' || metadata.scriptStrategy === 'segmented'
      ? metadata.scriptStrategy
      : null;

  const complexityInfo = readRecord(metadata.complexityInfo);
  const recommendedExecutionMode =
    complexityInfo?.recommendedExecutionMode === 'direct' || complexityInfo?.recommendedExecutionMode === 'segmented'
      ? complexityInfo.recommendedExecutionMode
      : null;
  const complexityScore =
    typeof complexityInfo?.score === 'number' && Number.isFinite(complexityInfo.score)
      ? complexityInfo.score
      : null;
  const outlinedChunkCount =
    typeof metadata.outlinedChunkCount === 'number' && Number.isFinite(metadata.outlinedChunkCount)
      ? metadata.outlinedChunkCount
      : null;
  const sourceChunkIndex =
    typeof metadata.sourceChunkIndex === 'number' && Number.isFinite(metadata.sourceChunkIndex)
      ? metadata.sourceChunkIndex
      : null;

  if (
    !executionMode &&
    chunkCount === null &&
    analyzedChunkCount === null &&
    outlinedChunkCount === null &&
    !analysisStrategy &&
    !outlineStrategy &&
    !scriptStrategy &&
    recommendedExecutionMode === null &&
    sourceChunkIndex === null
  ) {
    return null;
  }

  return {
    executionMode: executionMode ?? 'direct',
    recommendedExecutionMode,
    analysisStrategy,
    outlineStrategy,
    scriptStrategy,
    chunkCount: chunkCount ?? 1,
    analyzedChunkCount: analyzedChunkCount ?? 0,
    outlinedChunkCount: outlinedChunkCount ?? 0,
    complexityScore,
    sourceChunkIndex,
  } satisfies ScriptDiagnostics;
}

export function readMergedScriptDiagnostics(metadatas: ScriptDiagnosticsMetadata[]) {
  const diagnostics = metadatas
    .map((metadata) => readScriptDiagnostics(metadata))
    .filter((entry): entry is ScriptDiagnostics => Boolean(entry));

  if (diagnostics.length === 0) {
    return null;
  }

  const [first, ...rest] = diagnostics;

  return rest.reduce<ScriptDiagnostics>((merged, current) => ({
    executionMode:
      merged.executionMode === 'segmented' || current.executionMode === 'segmented'
        ? 'segmented'
        : 'direct',
    recommendedExecutionMode:
      current.recommendedExecutionMode ?? merged.recommendedExecutionMode,
    analysisStrategy: current.analysisStrategy ?? merged.analysisStrategy,
    outlineStrategy: current.outlineStrategy ?? merged.outlineStrategy,
    scriptStrategy: current.scriptStrategy ?? merged.scriptStrategy,
    chunkCount: Math.max(merged.chunkCount, current.chunkCount),
    analyzedChunkCount: Math.max(merged.analyzedChunkCount, current.analyzedChunkCount),
    outlinedChunkCount: Math.max(merged.outlinedChunkCount, current.outlinedChunkCount),
    complexityScore: current.complexityScore ?? merged.complexityScore,
    sourceChunkIndex: current.sourceChunkIndex ?? merged.sourceChunkIndex,
  }), first);
}

export function formatExecutionModeLabel(
  locale: SupportedLocale,
  mode: ScriptDiagnostics['executionMode']
) {
  if (locale === 'en-US') {
    return mode === 'segmented' ? 'Segmented execution' : 'Direct execution';
  }

  return mode === 'segmented' ? '分段执行' : '直接执行';
}

export function formatRecommendedExecutionModeLabel(
  locale: SupportedLocale,
  mode: ScriptDiagnostics['recommendedExecutionMode']
) {
  if (!mode) {
    return locale === 'en-US' ? 'N/A' : '未提供';
  }

  if (locale === 'en-US') {
    return mode === 'segmented' ? 'Recommended: segmented' : 'Recommended: direct';
  }

  return mode === 'segmented' ? '建议分段执行' : '建议直接执行';
}

export function formatAnalysisStrategyLabel(
  locale: SupportedLocale,
  strategy: ScriptDiagnostics['analysisStrategy']
) {
  if (!strategy) {
    return locale === 'en-US' ? 'N/A' : '未提供';
  }

  const labels =
    locale === 'en-US'
      ? {
          reused: 'Reused analysis',
          single: 'Single-pass analysis',
          segmented: 'Chunked analysis',
          segmented_fallback_single: 'Chunked analysis fallback to single-pass',
        }
      : {
          reused: '复用已有分析',
          single: '单次分析',
          segmented: '分段分析',
          segmented_fallback_single: '分段分析后回退到单次分析',
        };

  return labels[strategy];
}

export function formatOutlineStrategyLabel(
  locale: SupportedLocale,
  strategy: ScriptDiagnostics['outlineStrategy']
) {
  if (!strategy) {
    return locale === 'en-US' ? 'N/A' : '未提供';
  }

  const labels =
    locale === 'en-US'
      ? {
          single: 'Single-pass outline',
          segmented: 'Chunked outline',
          segmented_fallback_single: 'Chunked outline fallback to single-pass',
        }
      : {
          single: '单次大纲',
          segmented: '分段大纲',
          segmented_fallback_single: '分段大纲后回退到单次大纲',
        };

  return labels[strategy];
}

export function formatScriptStrategyLabel(
  locale: SupportedLocale,
  strategy: ScriptDiagnostics['scriptStrategy']
) {
  if (!strategy) {
    return locale === 'en-US' ? 'N/A' : '未提供';
  }

  if (locale === 'en-US') {
    return strategy === 'segmented' ? 'Chunked script' : 'Single-pass script';
  }

  return strategy === 'segmented' ? '分段剧本' : '单次剧本';
}

export function formatExecutionBehaviorSummary(
  locale: SupportedLocale,
  diagnostics: ScriptDiagnostics
) {
  const allSinglePass =
    diagnostics.analysisStrategy === 'single' &&
    (diagnostics.outlineStrategy === 'single' || diagnostics.outlineStrategy === null) &&
    (diagnostics.scriptStrategy === 'single' || diagnostics.scriptStrategy === null);

  if (diagnostics.executionMode === 'segmented' && diagnostics.chunkCount <= 1 && allSinglePass) {
    return locale === 'en-US'
      ? 'The source was short, so the system kept the segmented pipeline but executed this run as a single pass.'
      : '这次素材较短，因此系统保留了分段链路，但实际按单段策略完成本次生成。';
  }

  if (diagnostics.analysisStrategy === 'segmented_fallback_single') {
    return locale === 'en-US'
      ? 'Chunked analysis was attempted first, then the system fell back to a single-pass analysis for stability.'
      : '系统先尝试分段分析，随后为保证稳定性回退到单次分析。';
  }

  if (diagnostics.outlineStrategy === 'segmented_fallback_single') {
    return locale === 'en-US'
      ? 'Chunked outlining was attempted first, then the system fell back to a single-pass outline for stability.'
      : '系统先尝试分段大纲，随后为保证稳定性回退到单次大纲。';
  }

  if (diagnostics.executionMode === 'segmented') {
    return locale === 'en-US'
      ? 'This run used the segmented pipeline so long-form context could stay more stable across stages.'
      : '本次任务使用分段链路执行，用来在较长内容下保持各阶段上下文更稳定。';
  }

  return locale === 'en-US'
    ? 'This run used the direct pipeline path from analysis to script.'
    : '本次任务走的是直接链路，从分析到剧本按单段流程完成。';
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

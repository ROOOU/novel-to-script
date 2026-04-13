import { describe, expect, it } from 'vitest';
import {
  formatAnalysisStrategyLabel,
  formatExecutionBehaviorSummary,
  formatExecutionModeLabel,
  formatScriptStrategyLabel,
  readMergedScriptDiagnostics,
  readScriptDiagnostics,
} from '@/features/saas/project/job-diagnostics';

describe('job diagnostics', () => {
  it('reads segmented script diagnostics from analysis metadata', () => {
    const result = readScriptDiagnostics({
      executionMode: 'segmented',
      analysisStrategy: 'segmented',
      chunkCount: 3,
      analyzedChunkCount: 3,
      complexityInfo: {
        score: 84,
        recommendedExecutionMode: 'segmented',
      },
    });

    expect(result).toMatchObject({
      executionMode: 'segmented',
      recommendedExecutionMode: 'segmented',
      analysisStrategy: 'segmented',
      chunkCount: 3,
      analyzedChunkCount: 3,
      complexityScore: 84,
    });
  });

  it('returns null when no script diagnostics are present', () => {
    expect(readScriptDiagnostics({ parseError: null })).toBeNull();
  });

  it('keeps fallback information when segmented analysis drops to single-pass', () => {
    const result = readScriptDiagnostics({
      executionMode: 'segmented',
      analysisStrategy: 'segmented_fallback_single',
      chunkCount: 2,
      analyzedChunkCount: 1,
      complexityInfo: {
        score: 71,
        recommendedExecutionMode: 'segmented',
      },
    });

    expect(result).toMatchObject({
      executionMode: 'segmented',
      analysisStrategy: 'segmented_fallback_single',
      chunkCount: 2,
      analyzedChunkCount: 1,
      complexityScore: 71,
    });
  });

  it('merges diagnostics across analysis, outline, and script artifacts', () => {
    const result = readMergedScriptDiagnostics([
      {
        executionMode: 'segmented',
        analysisStrategy: 'single',
        chunkCount: 1,
        analyzedChunkCount: 1,
        complexityInfo: {
          score: 1,
          recommendedExecutionMode: 'direct',
        },
      },
      {
        executionMode: 'segmented',
        outlineStrategy: 'single',
        outlinedChunkCount: 1,
      },
      {
        executionMode: 'segmented',
        scriptStrategy: 'single',
        sourceChunkIndex: 2,
      },
    ]);

    expect(result).toEqual({
      executionMode: 'segmented',
      recommendedExecutionMode: 'direct',
      analysisStrategy: 'single',
      outlineStrategy: 'single',
      scriptStrategy: 'single',
      chunkCount: 1,
      analyzedChunkCount: 1,
      outlinedChunkCount: 1,
      complexityScore: 1,
      sourceChunkIndex: 2,
    });
  });

  it('formats execution and strategy labels for zh-CN', () => {
    expect(formatExecutionModeLabel('zh-CN', 'segmented')).toBe('分段执行');
    expect(formatAnalysisStrategyLabel('zh-CN', 'segmented_fallback_single')).toBe(
      '分段分析后回退到单次分析'
    );
    expect(formatScriptStrategyLabel('zh-CN', 'single')).toBe('单次剧本');
  });

  it('formats a product-style behavior summary for short segmented runs', () => {
    expect(
      formatExecutionBehaviorSummary('zh-CN', {
        executionMode: 'segmented',
        recommendedExecutionMode: 'direct',
        analysisStrategy: 'single',
        outlineStrategy: 'single',
        scriptStrategy: 'single',
        chunkCount: 1,
        analyzedChunkCount: 1,
        outlinedChunkCount: 1,
        complexityScore: 1,
        sourceChunkIndex: null,
      })
    ).toBe('这次素材较短，因此系统保留了分段链路，但实际按单段策略完成本次生成。');
  });
});

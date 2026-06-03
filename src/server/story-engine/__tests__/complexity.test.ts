import { describe, expect, it } from 'vitest';
import { buildStoryChunks } from '@/server/story-engine/chunking';
import { evaluateStoryComplexity } from '@/server/story-engine/complexity';

describe('story engine complexity', () => {
  it('classifies short simple text as direct', () => {
    const result = evaluateStoryComplexity('林晚走进咖啡馆，看见顾承砚已经坐在窗边等她。');

    expect(result.recommendedExecutionMode).toBe('direct');
    expect(result.chunkCount).toBe(1);
  });

  it('classifies long multi-scene text as segmented', () => {
    const text = Array.from({ length: 20 }, (_, index) =>
      `第${index + 1}段\n\n与此同时，林晚回到旧厂房，另一边顾承砚也在调查。几天后他们再次相遇。`
    ).join('\n\n');

    const result = evaluateStoryComplexity(text);

    expect(result.recommendedExecutionMode).toBe('segmented');
    expect(result.chunkCount).toBeGreaterThan(1);
  });

  it('builds multiple chunks for segmented text', () => {
    const text = Array.from({ length: 80 }, (_, index) =>
      `场景${index + 1}\n\n林晚在不同地点切换行动，同时另一边的顾承砚也在推进调查。` +
      '夜色里他们不断穿梭在旧厂房、医院、天桥和写字楼之间，局势持续升级。'
    ).join('\n\n');
    const complexity = evaluateStoryComplexity(text);
    const chunks = buildStoryChunks(text, complexity);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({
      chunkId: 'chunk-01',
      index: 1,
    });
  });

  it('returns a single chunk with full char count for direct execution mode', () => {
    const text = '林晚走进咖啡馆，看见顾承砚已经坐在窗边等她。';
    const complexity = evaluateStoryComplexity(text);
    const chunks = buildStoryChunks(text, complexity);

    expect(complexity.recommendedExecutionMode).toBe('direct');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.charCount).toBe(text.length);
  });

  it('prioritizes chapter boundaries when segmented text includes chapter headings', () => {
    const text = [
      `第一章 开场\n\n${'甲'.repeat(1600)}`,
      `第二章 进展\n\n${'乙'.repeat(1600)}`,
      `第三章 反转\n\n${'丙'.repeat(1600)}`,
      `第四章 决断\n\n${'丁'.repeat(1600)}`,
    ].join('\n\n');

    const chunks = buildStoryChunks(text, {
      score: 100,
      textLength: text.length,
      estimatedSceneBreaks: 4,
      estimatedTimeJumps: 0,
      estimatedPovSwitches: 0,
      estimatedCharacterDensity: 0,
      recommendedExecutionMode: 'segmented',
      chunkCount: 2,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.text.startsWith('第一章 开场')).toBe(true);
    expect(chunks[0]?.text).toContain('第二章 进展');
    expect(chunks[0]?.text).not.toContain('第三章 反转');
    expect(chunks[1]?.text.startsWith('第三章 反转')).toBe(true);
    expect(chunks[1]?.text).toContain('第四章 决断');
  });
});

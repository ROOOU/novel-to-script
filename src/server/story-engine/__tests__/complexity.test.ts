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
});

import { describe, expect, it } from 'vitest';
import {
  formatArtifactKind,
  formatCounterLabel,
  formatJobKind,
  formatJobStatus,
  formatLocaleDateTime,
} from '@/features/saas/project/presentation';

describe('project presentation helpers', () => {
  it('formats job and artifact copy for both locales', () => {
    expect(formatJobStatus('zh-CN', 'running')).toBe('运行中');
    expect(formatJobStatus('en-US', 'failed')).toBe('Failed');
    expect(formatJobKind('zh-CN', 'script-generation')).toBe('剧本');
    expect(formatArtifactKind('en-US', 'storyboard')).toBe('Storyboard');
  });

  it('formats date strings with locale-aware fallbacks', () => {
    expect(formatLocaleDateTime('zh-CN', null)).toBe('—');
    expect(formatLocaleDateTime('en-US', 'not-a-date')).toBe('not-a-date');
  });

  it('builds count labels without hardcoded English-only suffixes', () => {
    expect(formatCounterLabel('en-US', 1, 'job', 'jobs', '任务')).toBe('1 job');
    expect(formatCounterLabel('en-US', 3, 'job', 'jobs', '任务')).toBe('3 jobs');
    expect(formatCounterLabel('zh-CN', 4, 'job', 'jobs', '任务')).toBe('4 任务');
  });
});

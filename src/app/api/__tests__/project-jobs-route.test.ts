import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/generation/service', () => ({
  createProjectGenerationJob: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: vi.fn(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: vi.fn(),
}));

import { createJobSchema } from '@/app/api/projects/[projectId]/jobs/schema';

describe('createJobSchema', () => {
  it('parses script generation jobs as a discriminated union branch', () => {
    const parsed = createJobSchema.parse({
      kind: 'script-generation',
      payload: {
        text: '原文',
        genre: 'urban',
        config: {
          genre: 'urban',
          episodeCount: 3,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
      },
    });

    expect(parsed.kind).toBe('script-generation');
    if (parsed.kind !== 'script-generation') {
      throw new Error('Expected script-generation branch');
    }
    expect(parsed.payload.config.episodeCount).toBe(3);
  });

  it('parses storyboard generation jobs with scriptArtifactIds support', () => {
    const parsed = createJobSchema.parse({
      kind: 'storyboard-generation',
      payload: {
        scope: 'selection',
        scriptArtifactIds: ['script_a', 'script_b'],
        selection: {
          episodeNumbers: [1, 3],
        },
        visualStyle: 'cinematic',
        safeMode: true,
      },
    });

    expect(parsed.kind).toBe('storyboard-generation');
    if (parsed.kind !== 'storyboard-generation') {
      throw new Error('Expected storyboard-generation branch');
    }
    expect(parsed.payload.scriptArtifactIds).toEqual(['script_a', 'script_b']);
    expect(parsed.payload.scope).toBe('selection');
    expect(parsed.payload.selection?.episodeNumbers).toEqual([1, 3]);
  });

  it('rejects storyboard generation jobs without script text or script artifacts', () => {
    expect(() =>
      createJobSchema.parse({
        kind: 'storyboard-generation',
        payload: {
          visualStyle: 'cinematic',
        },
      })
    ).toThrow(/scriptText or scriptArtifactIds/i);
  });

  it('rejects selection-scoped storyboard jobs without selection criteria', () => {
    expect(() =>
      createJobSchema.parse({
        kind: 'storyboard-generation',
        payload: {
          scope: 'selection',
          scriptArtifactIds: ['script_a'],
        },
      })
    ).toThrow(/selection criteria/i);
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NovelAnalysis, OutlineEntry } from '@/lib/types';
import { runScriptGeneration } from '@/server/script-generation/application/run-script-generation';

const mocks = vi.hoisted(() => ({
  analyzeNovel: vi.fn(),
  generateOutline: vi.fn(),
  generateScript: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  analyzeNovel: (...args: unknown[]) => mocks.analyzeNovel(...args),
  generateOutline: (...args: unknown[]) => mocks.generateOutline(...args),
  generateScript: (...args: unknown[]) => mocks.generateScript(...args),
}));

describe('runScriptGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateOutline.mockResolvedValue(JSON.stringify([
      {
        episodeNumber: 1,
        title: '第一集',
        summary: '梗概',
        keyEvents: ['相遇'],
        hook: '她决定反击',
      } satisfies OutlineEntry,
    ]));
    mocks.generateScript.mockReturnValue(singleChunkStream('剧本正文'));
  });

  it('uses chunked analysis and merges the result when executionMode=segmented', async () => {
    const segmentedText = `${'第一段'.repeat(900)}\n\n${'第二段'.repeat(900)}`;
    mocks.analyzeNovel
      .mockResolvedValueOnce(JSON.stringify(buildAnalysis({
        title: '上半部',
        plotSummary: '林晚回到旧厂房。',
        characters: [
          {
            name: '林晚',
            description: '女主回城',
            personality: '克制',
            speechStyle: '简短',
            relationships: ['顾承砚:旧识'],
          },
        ],
        keyConflicts: ['旧案重启'],
      })))
      .mockResolvedValueOnce(JSON.stringify(buildAnalysis({
        title: '下半部',
        plotSummary: '顾承砚交出线索。',
        characters: [
          {
            name: '顾承砚',
            description: '男主守在门口',
            personality: '隐忍',
            speechStyle: '冷静',
            relationships: ['林晚:旧识'],
          },
        ],
        climaxPoints: ['真相浮出水面'],
      })));
    mocks.generateOutline
      .mockResolvedValueOnce(JSON.stringify([
        {
          episodeNumber: 1,
          title: '上半集',
          summary: '旧案重启',
          keyEvents: ['林晚回城'],
          hook: '顾承砚现身',
        } satisfies OutlineEntry,
      ]))
      .mockResolvedValueOnce(JSON.stringify([
        {
          episodeNumber: 1,
          title: '下半集',
          summary: '线索交出',
          keyEvents: ['真相浮现'],
          hook: '风暴将至',
        } satisfies OutlineEntry,
      ]));

    const artifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];
    await runScriptGeneration({
      body: {
        text: segmentedText,
        genre: 'urban',
        executionMode: 'segmented',
        complexityInfo: {
          score: 80,
          textLength: 9000,
          estimatedSceneBreaks: 6,
          estimatedTimeJumps: 2,
          estimatedPovSwitches: 1,
          estimatedCharacterDensity: 5,
          recommendedExecutionMode: 'segmented',
          chunkCount: 2,
        },
        config: {
          genre: 'urban',
          episodeCount: 2,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
      },
      context: buildContext(),
      send: vi.fn(),
      llmConfig: { apiKey: 'sk-test', modelName: 'test-model' },
      onArtifact: async (artifact) => {
        artifacts.push(artifact);
      },
    });

    expect(mocks.analyzeNovel).toHaveBeenCalledTimes(2);
    expect(mocks.generateOutline).toHaveBeenCalledTimes(2);
    expect(mocks.generateScript).toHaveBeenCalledTimes(2);
    expect(mocks.analyzeNovel.mock.calls[0]?.[0]).toContain('第一段');
    expect(mocks.analyzeNovel.mock.calls[1]?.[0]).toContain('第二段');
    expect(mocks.generateScript.mock.calls[0]?.[0]).toContain('上半集');
    expect(mocks.generateScript.mock.calls[0]?.[0]).not.toContain('下半集');
    expect(mocks.generateScript.mock.calls[0]?.[1]).toContain('林晚回到旧厂房。');
    expect(mocks.generateScript.mock.calls[0]?.[1]).not.toContain('顾承砚交出线索。');
    expect(mocks.generateScript.mock.calls[1]?.[0]).toContain('下半集');
    expect(mocks.generateScript.mock.calls[1]?.[0]).not.toContain('上半集');
    expect(mocks.generateScript.mock.calls[1]?.[1]).toContain('顾承砚交出线索。');
    expect(mocks.generateScript.mock.calls[1]?.[1]).not.toContain('林晚回到旧厂房。');

    const analysisArtifact = artifacts.find((artifact) => artifact.kind === 'analysis');
    const outlineArtifact = artifacts.find((artifact) => artifact.kind === 'outline');
    const scriptArtifacts = artifacts.filter((artifact) => artifact.kind === 'script');
    expect(analysisArtifact).toBeTruthy();
    expect(analysisArtifact?.metadata).toMatchObject({
      executionMode: 'segmented',
      analyzedChunkCount: 2,
      analysisStrategy: 'segmented',
    });
    expect(JSON.parse(analysisArtifact?.content ?? '{}')).toMatchObject({
      title: '上半部',
      plotSummary: expect.stringContaining('林晚回到旧厂房。'),
      keyConflicts: ['旧案重启'],
      climaxPoints: ['真相浮出水面'],
      characters: expect.arrayContaining([
        expect.objectContaining({ name: '林晚' }),
        expect.objectContaining({ name: '顾承砚' }),
      ]),
    });
    expect(outlineArtifact?.metadata).toMatchObject({
      executionMode: 'segmented',
      outlinedChunkCount: 2,
      outlineStrategy: 'segmented',
    });
    expect(JSON.parse(outlineArtifact?.content ?? '[]')).toEqual([
      expect.objectContaining({ episodeNumber: 1, title: '上半集' }),
      expect.objectContaining({ episodeNumber: 2, title: '下半集' }),
    ]);
    expect(scriptArtifacts).toHaveLength(2);
    expect(scriptArtifacts[0]?.metadata).toMatchObject({
      executionMode: 'segmented',
      scriptStrategy: 'segmented',
      sourceChunkIndex: 1,
    });
    expect(scriptArtifacts[1]?.metadata).toMatchObject({
      executionMode: 'segmented',
      scriptStrategy: 'segmented',
      sourceChunkIndex: 2,
    });
  });

  it('falls back to single-pass analysis when a chunk result cannot be parsed', async () => {
    const segmentedText = `${'第一段'.repeat(900)}\n\n${'第二段'.repeat(900)}`;
    mocks.analyzeNovel
      .mockResolvedValueOnce('not-json')
      .mockResolvedValueOnce(JSON.stringify(buildAnalysis({
        title: '整篇汇总',
        plotSummary: '整篇回退分析。',
      })));

    const artifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];
    await runScriptGeneration({
      body: {
        text: segmentedText,
        genre: 'urban',
        executionMode: 'segmented',
        complexityInfo: {
          score: 80,
          textLength: 9000,
          estimatedSceneBreaks: 6,
          estimatedTimeJumps: 2,
          estimatedPovSwitches: 1,
          estimatedCharacterDensity: 5,
          recommendedExecutionMode: 'segmented',
          chunkCount: 2,
        },
        config: {
          genre: 'urban',
          episodeCount: 1,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
      },
      context: buildContext(),
      send: vi.fn(),
      llmConfig: { apiKey: 'sk-test', modelName: 'test-model' },
      onArtifact: async (artifact) => {
        artifacts.push(artifact);
      },
    });

    expect(mocks.analyzeNovel).toHaveBeenCalledTimes(2);
    const analysisArtifact = artifacts.find((artifact) => artifact.kind === 'analysis');
    expect(analysisArtifact?.metadata).toMatchObject({
      analysisStrategy: 'segmented_fallback_single',
      analyzedChunkCount: 1,
    });
    expect(JSON.parse(analysisArtifact?.content ?? '{}')).toMatchObject({
      title: '整篇汇总',
      plotSummary: '整篇回退分析。',
    });
  });

  it('falls back to single-pass outline when a segmented outline chunk cannot be parsed', async () => {
    const segmentedText = `${'第一段'.repeat(900)}\n\n${'第二段'.repeat(900)}`;
    mocks.analyzeNovel
      .mockResolvedValueOnce(JSON.stringify(buildAnalysis({
        title: '上半部',
        plotSummary: '林晚回到旧厂房。',
      })))
      .mockResolvedValueOnce(JSON.stringify(buildAnalysis({
        title: '下半部',
        plotSummary: '顾承砚交出线索。',
      })));
    mocks.generateOutline
      .mockResolvedValueOnce('not-json')
      .mockResolvedValueOnce(JSON.stringify([
        {
          episodeNumber: 1,
          title: '整篇大纲',
          summary: '整篇回退',
          keyEvents: ['相遇'],
          hook: '危机升级',
        } satisfies OutlineEntry,
      ]));

    const artifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];
    await runScriptGeneration({
      body: {
        text: segmentedText,
        genre: 'urban',
        executionMode: 'segmented',
        complexityInfo: {
          score: 80,
          textLength: 9000,
          estimatedSceneBreaks: 6,
          estimatedTimeJumps: 2,
          estimatedPovSwitches: 1,
          estimatedCharacterDensity: 5,
          recommendedExecutionMode: 'segmented',
          chunkCount: 2,
        },
        config: {
          genre: 'urban',
          episodeCount: 1,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
      },
      context: buildContext(),
      send: vi.fn(),
      llmConfig: { apiKey: 'sk-test', modelName: 'test-model' },
      onArtifact: async (artifact) => {
        artifacts.push(artifact);
      },
    });

    expect(mocks.generateOutline).toHaveBeenCalledTimes(2);
    expect(mocks.generateScript).toHaveBeenCalledTimes(1);
    const outlineArtifact = artifacts.find((artifact) => artifact.kind === 'outline');
    const scriptArtifact = artifacts.find((artifact) => artifact.kind === 'script');
    expect(outlineArtifact?.metadata).toMatchObject({
      outlineStrategy: 'segmented_fallback_single',
      outlinedChunkCount: 1,
    });
    expect(JSON.parse(outlineArtifact?.content ?? '[]')).toEqual([
      expect.objectContaining({ title: '整篇大纲' }),
    ]);
    expect(scriptArtifact?.metadata).toMatchObject({
      executionMode: 'segmented',
      scriptStrategy: 'single',
      sourceChunkIndex: null,
    });
  });

  it('keeps global episode numbering stable when one chunk maps to multiple episodes', async () => {
    const segmentedText = `${'第一段'.repeat(900)}\n\n${'第二段'.repeat(900)}`;
    mocks.analyzeNovel
      .mockResolvedValueOnce(JSON.stringify(buildAnalysis({
        title: '上半部',
        plotSummary: '林晚回到旧厂房。',
      })))
      .mockResolvedValueOnce(JSON.stringify(buildAnalysis({
        title: '下半部',
        plotSummary: '顾承砚交出线索。',
      })));
    mocks.generateOutline
      .mockResolvedValueOnce(JSON.stringify([
        {
          episodeNumber: 1,
          title: '上半集一',
          summary: '旧案重启',
          keyEvents: ['林晚回城'],
          hook: '顾承砚现身',
        } satisfies OutlineEntry,
        {
          episodeNumber: 2,
          title: '上半集二',
          summary: '旧案升级',
          keyEvents: ['继续追查'],
          hook: '风暴将至',
        } satisfies OutlineEntry,
      ]))
      .mockResolvedValueOnce(JSON.stringify([
        {
          episodeNumber: 1,
          title: '下半集一',
          summary: '线索交出',
          keyEvents: ['真相浮现'],
          hook: '最终对峙',
        } satisfies OutlineEntry,
      ]));

    const artifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];
    await runScriptGeneration({
      body: {
        text: segmentedText,
        genre: 'urban',
        executionMode: 'segmented',
        complexityInfo: {
          score: 80,
          textLength: 9000,
          estimatedSceneBreaks: 6,
          estimatedTimeJumps: 2,
          estimatedPovSwitches: 1,
          estimatedCharacterDensity: 5,
          recommendedExecutionMode: 'segmented',
          chunkCount: 2,
        },
        config: {
          genre: 'urban',
          episodeCount: 3,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
      },
      context: buildContext(),
      send: vi.fn(),
      llmConfig: { apiKey: 'sk-test', modelName: 'test-model' },
      onArtifact: async (artifact) => {
        artifacts.push(artifact);
      },
    });

    expect(mocks.generateScript).toHaveBeenCalledTimes(3);
    expect(mocks.generateScript.mock.calls[0]?.[0]).toContain('上半集一');
    expect(mocks.generateScript.mock.calls[0]?.[0]).toContain('上半集二');
    expect(mocks.generateScript.mock.calls[0]?.[0]).not.toContain('下半集一');
    expect(mocks.generateScript.mock.calls[1]?.[0]).toContain('上半集一');
    expect(mocks.generateScript.mock.calls[1]?.[0]).toContain('上半集二');
    expect(mocks.generateScript.mock.calls[1]?.[0]).not.toContain('下半集一');
    expect(mocks.generateScript.mock.calls[2]?.[0]).toContain('下半集一');
    expect(mocks.generateScript.mock.calls[2]?.[0]).not.toContain('上半集一');
    expect(mocks.generateScript.mock.calls[0]?.[3]).toBe(1);
    expect(mocks.generateScript.mock.calls[1]?.[3]).toBe(2);
    expect(mocks.generateScript.mock.calls[2]?.[3]).toBe(3);

    const outlineArtifact = artifacts.find((artifact) => artifact.kind === 'outline');
    const scriptArtifacts = artifacts.filter((artifact) => artifact.kind === 'script');
    expect(JSON.parse(outlineArtifact?.content ?? '[]')).toEqual([
      expect.objectContaining({ episodeNumber: 1, title: '上半集一' }),
      expect.objectContaining({ episodeNumber: 2, title: '上半集二' }),
      expect.objectContaining({ episodeNumber: 3, title: '下半集一' }),
    ]);
    expect(scriptArtifacts).toHaveLength(3);
    expect(scriptArtifacts[0]?.metadata).toMatchObject({ sourceChunkIndex: 1, scriptStrategy: 'segmented' });
    expect(scriptArtifacts[1]?.metadata).toMatchObject({ sourceChunkIndex: 1, scriptStrategy: 'segmented' });
    expect(scriptArtifacts[2]?.metadata).toMatchObject({ sourceChunkIndex: 2, scriptStrategy: 'segmented' });
  });
});

function buildAnalysis(overrides: Partial<NovelAnalysis>): NovelAnalysis {
  return {
    title: '测试标题',
    genre: 'urban',
    characters: [],
    plotSummary: '测试剧情',
    keyConflicts: [],
    climaxPoints: [],
    emotionalBeats: [],
    ...overrides,
  };
}

function buildContext() {
  return {
    requestId: 'req_1',
    traceId: 'trace_1',
    clientIp: '127.0.0.1',
    userAgent: 'vitest',
    referer: null,
    locale: 'zh-CN',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    userId: 'user_1',
    sessionId: null,
    plan: 'creator' as const,
    source: 'default' as const,
  };
}

async function* singleChunkStream(content: string) {
  yield content;
}

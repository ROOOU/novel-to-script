import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getStoryboardRequestError,
  parseStoryboardOutput,
  resolveStoryboardScriptSource,
  runStoryboardGeneration,
  softenSensitiveContent,
} from '@/server/storyboard/application/run-storyboard-generation';

const streamLLM = vi.fn();
const getPlatformRuntime = vi.fn();

vi.mock('@/lib/llm', () => ({
  streamLLM: (...args: unknown[]) => streamLLM(...args),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => getPlatformRuntime(),
}));

describe('storyboard generation request handling', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accepts storyboard requests that only reference source script artifacts', () => {
    expect(
      getStoryboardRequestError({
        scriptArtifactIds: ['script_1'],
        visualStyle: 'cinematic',
      })
    ).toBeNull();
  });

  it('accepts selection-scoped storyboard requests that directly reference source artifacts', () => {
    expect(
      getStoryboardRequestError({
        scope: 'selection',
        selection: {
          artifactIds: ['script_2'],
        },
      })
    ).toBeNull();
  });

  it('softens high-risk storyboard wording before safe-mode generation', () => {
    const softened = softenSensitiveContent(`
战场边缘，兵卫押着嫌犯进入黑市据点，准备审问线人。
封印失控后整座山谷可能崩塌，几支大军已经开始追杀逃离的人。
地上还有鲜血痕迹，对方声称若不配合就立刻处死。
    `);

    expect(softened).not.toMatch(/战场|兵卫|黑市|审问|封印失控|崩塌|大军|追杀|鲜血|处死/);
    expect(softened).toContain('阵营对峙');
    expect(softened).toContain('灰色交易传闻');
    expect(softened).toContain('强势施压');
    expect(softened).toContain('局势失衡');
    expect(softened).toContain('紧张追逐');
    expect(softened).toContain('危险痕迹');
    expect(softened).toContain('立刻处置');
  });

  it('prefers source artifacts over fallback script text and records their ids', async () => {
    const getById = vi.fn(async (id: string) => {
      if (id === 'script_1') {
        return {
          id: 'script_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
          projectId: 'proj_1',
          kind: 'script',
          content: '1-1 日 内 客厅\n阿明：来自工件',
        };
      }

      return null;
    });

    getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById,
      },
    });

    let capturedUserPrompt = '';
    streamLLM.mockImplementation(async function* (_systemPrompt: string, userPrompt: string) {
      capturedUserPrompt = userPrompt;
      yield `分镜① 4s：时间：夜，场景图片：🖼️客厅_0，镜头：中景，缓慢推进，🧑 阿明-基础形象-基础形象 走向门口。

[SHOTS_JSON]
\`\`\`json
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01",
    "shotType": "中景",
    "camera": "缓慢推进",
    "composition": "单人居中构图",
    "motion": "阿明走向门口",
    "subject": "阿明",
    "environment": "夜晚客厅",
    "lighting": "室内暖光",
    "audioHint": "脚步声由远及近",
    "videoPrompt": "夜晚客厅，中景，缓慢推进，阿明走向门口，室内暖光，脚步声由远及近"
  }
]
\`\`\``;
    });

    const onArtifact = vi.fn();
    const send = vi.fn();

    await runStoryboardGeneration({
      body: {
        scriptText: 'fallback script text',
        scriptArtifactIds: ['script_1'],
        visualStyle: 'cinematic realism',
        colorTone: 'warm tone',
        genreLabel: '都市女频',
        safeMode: false,
      },
      context: {
        requestId: 'req_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        plan: 'free',
      } as never,
      jobId: 'job_1',
      send,
      llmConfig: {} as never,
      onArtifact,
    });

    expect(getById).toHaveBeenCalledWith('script_1');
    expect(capturedUserPrompt).toContain('来自工件');
    expect(capturedUserPrompt).not.toContain('fallback script text');
    expect(capturedUserPrompt).toContain('[SHOTS_JSON]');
    expect(onArtifact).toHaveBeenCalledTimes(3);
    expect(onArtifact.mock.calls[0][0]).toMatchObject({
      kind: 'storyboard',
    });
    expect(onArtifact.mock.calls[0][0].metadata).toMatchObject({
      sourceScriptArtifactIds: ['script_1'],
      shotCount: 1,
      shots: [
        expect.objectContaining({
          sceneId: 'S01',
          shotId: 'S01-SH01',
          subject: '阿明',
        }),
      ],
    });
    expect(onArtifact.mock.calls[0][0].metadata).not.toHaveProperty('parseFallbackMode');
    expect(onArtifact.mock.calls[0][0].content).not.toContain('[SHOTS_JSON]');
    expect(onArtifact.mock.calls[1][0]).toMatchObject({
      kind: 'shot_plan',
      format: 'application/json',
    });
    expect(onArtifact.mock.calls[2][0]).toMatchObject({
      kind: 'prompt_pack',
      format: 'application/json',
      metadata: expect.objectContaining({
        targetPlatform: 'generic-video',
      }),
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'done',
        content: expect.not.stringContaining('[SHOTS_JSON]'),
      })
    );
  });

  it('adds Seedance guidance and emits Seedance prompt packs when requested', async () => {
    let capturedUserPrompt = '';
    streamLLM.mockImplementation(async function* (_systemPrompt: string, userPrompt: string) {
      capturedUserPrompt = userPrompt;
      yield `分镜① 6s：时间：夜，场景图片：🖼️便利店_0，镜头：中景，低机位跟拍后缓慢推进，🧑 林晚-基础形象-基础形象 推开玻璃门并停顿。

[SHOTS_JSON]
\`\`\`json
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01",
    "shotType": "中景",
    "camera": "低机位跟拍后缓慢推进",
    "composition": "人物居中，前景玻璃反射",
    "motion": "林晚推开玻璃门并停顿一秒",
    "subject": "林晚",
    "environment": "雨夜便利店",
    "lighting": "霓虹灯与室内暖光交错",
    "audioHint": "雨声、门铃声和呼吸声同步",
    "videoPrompt": "雨夜便利店，中景，低机位跟拍后缓慢推进，林晚推开玻璃门并停顿一秒，霓虹灯反射，雨声、门铃声和呼吸声同步"
  }
]
\`\`\``;
    });

    const onArtifact = vi.fn();

    await runStoryboardGeneration({
      body: {
        scriptText: '1-1 夜 内 便利店\n林晚推开便利店玻璃门，听见门铃响起。',
        visualStyle: '真人写实',
        colorTone: '暖色调',
        genreLabel: '都市女频',
        targetPlatform: 'seedance',
      },
      context: {
        requestId: 'req_seedance',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        plan: 'free',
      } as never,
      jobId: 'job_seedance',
      send: vi.fn(),
      llmConfig: {} as never,
      onArtifact,
    });

    expect(capturedUserPrompt).toContain('Seedance 2.0 官方案例式分解要求');
    expect(capturedUserPrompt).toContain('15s短剧分镜');

    const promptPackArtifact = onArtifact.mock.calls[2]?.[0];
    expect(promptPackArtifact).toMatchObject({
      kind: 'prompt_pack',
      metadata: expect.objectContaining({
        targetPlatform: 'seedance',
      }),
    });
    const promptPack = JSON.parse(promptPackArtifact.content);
    expect(promptPack[0]).toMatchObject({
      targetPlatform: 'seedance',
    });
    expect(promptPack[0].copyReadyText).toContain('Seedance 2.0 官方案例式分解');
    expect(promptPack[0].copyReadyText).toContain('音频/对白');
  });

  it('resolves storyboard script text from a script artifact list helper', async () => {
    getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById: vi.fn(async () => ({
          id: 'script_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
          projectId: 'proj_1',
          kind: 'script',
          content: 'A',
        })),
      },
    });

    await expect(
      resolveStoryboardScriptSource({
        scriptText: 'fallback',
        scriptArtifactIds: ['script_1'],
      })
    ).resolves.toMatchObject({
      scriptText: 'A',
      sourceScriptArtifactIds: ['script_1'],
    });
  });

  it('filters storyboard source artifacts by selection artifact ids', async () => {
    getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById: vi.fn(async (artifactId: string) => {
          if (artifactId === 'script_1') {
            return {
              id: 'script_1',
              organizationId: 'org_1',
              workspaceId: 'ws_1',
              projectId: 'proj_1',
              kind: 'script',
              content: '第1集内容',
              metadata: { episode: 1 },
            };
          }

          if (artifactId === 'script_2') {
            return {
              id: 'script_2',
              organizationId: 'org_1',
              workspaceId: 'ws_1',
              projectId: 'proj_1',
              kind: 'script',
              content: '第2集内容',
              metadata: { episode: 2 },
            };
          }

          return null;
        }),
      },
    });

    await expect(
      resolveStoryboardScriptSource({
        scriptArtifactIds: ['script_1', 'script_2'],
        scope: 'selection',
        selection: {
          artifactIds: ['script_2'],
        },
      })
    ).resolves.toMatchObject({
      scriptText: '第2集内容',
      sourceScriptArtifactIds: ['script_2'],
    });
  });

  it('rejects script artifacts outside the current worker scope', async () => {
    getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById: vi.fn(async () => ({
          id: 'script_1',
          organizationId: 'org_other',
          workspaceId: 'ws_other',
          projectId: 'proj_other',
          kind: 'script',
          content: 'A',
        })),
      },
    });

    await expect(
      resolveStoryboardScriptSource(
        {
          scriptArtifactIds: ['script_1'],
        },
        {
          organizationId: 'org_1',
          workspaceId: 'ws_1',
          projectId: 'proj_1',
        }
      )
    ).rejects.toThrow('SCRIPT_ARTIFACT_SCOPE_INVALID:script_1');
  });

  it('parses storyboard text and shots from the [SHOTS_JSON] block', () => {
    expect(
      parseStoryboardOutput(`镜头1｜中景｜角色转身

[SHOTS_JSON]
\`\`\`json
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01",
    "shotType": "中景",
    "camera": "固定机位",
    "composition": "单人偏左构图",
    "motion": "角色缓慢转身",
    "subject": "林晚",
    "environment": "办公室",
    "lighting": "顶部冷白光",
    "audioHint": "空调低频环境声",
    "videoPrompt": "办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声"
  }
]
\`\`\``)
    ).toEqual({
      textContent: '镜头1｜中景｜角色转身',
      shots: [
        {
          sceneId: 'S01',
          shotId: 'S01-SH01',
          shotType: '中景',
          camera: '固定机位',
          composition: '单人偏左构图',
          motion: '角色缓慢转身',
          subject: '林晚',
          environment: '办公室',
          lighting: '顶部冷白光',
          audioHint: '空调低频环境声',
          videoPrompt: '办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声',
        },
      ],
    });
  });

  it('parses storyboard shots from a trailing json fence without the [SHOTS_JSON] marker', () => {
    expect(
      parseStoryboardOutput(`镜头1｜中景｜角色转身

\`\`\`json
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01",
    "shotType": "中景",
    "camera": "固定机位",
    "composition": "单人偏左构图",
    "motion": "角色缓慢转身",
    "subject": "林晚",
    "environment": "办公室",
    "lighting": "顶部冷白光",
    "audioHint": "空调低频环境声",
    "videoPrompt": "办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声"
  }
]
\`\`\``)
    ).toEqual({
      textContent: '镜头1｜中景｜角色转身',
      shots: [
        expect.objectContaining({
          sceneId: 'S01',
          shotId: 'S01-SH01',
        }),
      ],
    });
  });

  it('accepts storyboard json wrapped in a shots object', () => {
    expect(
      parseStoryboardOutput(`镜头1｜中景｜角色转身

[SHOTS_JSON]
\`\`\`json
{
  "shots": [
    {
      "sceneId": "S01",
      "shotId": "S01-SH01",
      "shotType": "中景",
      "camera": "固定机位",
      "composition": "单人偏左构图",
      "motion": "角色缓慢转身",
      "subject": "林晚",
      "environment": "办公室",
      "lighting": "顶部冷白光",
      "audioHint": "空调低频环境声",
      "videoPrompt": "办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声"
    }
  ]
}
\`\`\``)
    ).toEqual({
      textContent: '镜头1｜中景｜角色转身',
      shots: [
        expect.objectContaining({
          sceneId: 'S01',
          shotId: 'S01-SH01',
        }),
      ],
    });
  });

  it('accepts storyboard json wrapped in nested data containers', () => {
    expect(
      parseStoryboardOutput(`镜头1｜中景｜角色转身

[SHOTS_JSON]
\`\`\`json
{
  "result": {
    "storyboard": [
      {
        "sceneId": "S01",
        "shotId": "S01-SH01",
        "shotType": "中景",
        "camera": "固定机位",
        "composition": "单人偏左构图",
        "motion": "角色缓慢转身",
        "subject": "林晚",
        "environment": "办公室",
        "lighting": "顶部冷白光",
        "audioHint": "空调低频环境声",
        "videoPrompt": "办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声"
      }
    ]
  }
}
\`\`\``)
    ).toEqual({
      textContent: '镜头1｜中景｜角色转身',
      shots: [
        expect.objectContaining({
          sceneId: 'S01',
          shotId: 'S01-SH01',
        }),
      ],
    });
  });

  it('accepts storyboard shots from a generic fenced block when it still looks like json', () => {
    expect(
      parseStoryboardOutput(`镜头1｜中景｜角色转身

\`\`\`
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01",
    "shotType": "中景",
    "camera": "固定机位",
    "composition": "单人偏左构图",
    "motion": "角色缓慢转身",
    "subject": "林晚",
    "environment": "办公室",
    "lighting": "顶部冷白光",
    "audioHint": "空调低频环境声",
    "videoPrompt": "办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声"
  }
]
\`\`\``)
    ).toEqual({
      textContent: '镜头1｜中景｜角色转身',
      shots: [
        expect.objectContaining({
          sceneId: 'S01',
          shotId: 'S01-SH01',
        }),
      ],
    });
  });

  it('accepts storyboard shot field aliases before falling back to text reconstruction', () => {
    expect(
      parseStoryboardOutput(`镜头1｜中景｜角色转身

[SHOTS_JSON]
\`\`\`json
[
  {
    "scene_id": "S01",
    "shot_id": "S01-SH01",
    "shot_type": "中景",
    "camera_move": "固定机位",
    "framing": "单人偏左构图",
    "action": "角色缓慢转身",
    "character": "林晚",
    "setting": "办公室",
    "light": "顶部冷白光",
    "sound": "空调低频环境声",
    "prompt": "办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声"
  }
]
\`\`\``)
    ).toEqual({
      textContent: '镜头1｜中景｜角色转身',
      shots: [
        expect.objectContaining({
          sceneId: 'S01',
          shotId: 'S01-SH01',
          shotType: '中景',
          subject: '林晚',
          videoPrompt: '办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声',
        }),
      ],
    });
  });

  it('repairs storyboard json with smart quotes, trailing commas, and trailing prose', () => {
    expect(
      parseStoryboardOutput(`镜头1｜中景｜角色转身

[SHOTS_JSON]
\`\`\`json
[
  {
    “sceneId”: “S01”,
    “shotId”: “S01-SH01”,
    “shotType”: “中景”,
    “camera”: “固定机位”,
    “composition”: “单人偏左构图”,
    “motion”: “角色缓慢转身”,
    “subject”: “林晚”,
    “environment”: “办公室”,
    “lighting”: “顶部冷白光”,
    “audioHint”: “空调低频环境声”,
    “videoPrompt”: “办公室，中景，固定机位，林晚缓慢转身，顶部冷白光，空调低频环境声”,
  }
]
\`\`\`

以上是结构化镜头。`)
    ).toEqual({
      textContent: '镜头1｜中景｜角色转身',
      shots: [
        expect.objectContaining({
          sceneId: 'S01',
          shotId: 'S01-SH01',
          subject: '林晚',
        }),
      ],
    });
  });

  it('falls back to text-only storyboard output when structured json is missing', async () => {
    streamLLM.mockImplementation(async function* () {
      yield '分镜① 4s：时间：夜，场景图片：🖼️客厅_0，镜头：中景，缓慢推进，🧑 阿明-基础形象-基础形象 走向门口。';
    });

    const onArtifact = vi.fn();
    const send = vi.fn();

    await runStoryboardGeneration({
      body: {
        scriptText: '1-1 日 内 客厅\n阿明：测试文本',
        visualStyle: 'cinematic realism',
        colorTone: 'warm tone',
        genreLabel: '都市女频',
        safeMode: false,
      },
      context: {
        requestId: 'req_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        plan: 'free',
      } as never,
      jobId: 'job_1',
      send,
      llmConfig: {} as never,
      onArtifact,
    });

    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'storyboard',
        content: '分镜① 4s：时间：夜，场景图片：🖼️客厅_0，镜头：中景，缓慢推进，🧑 阿明-基础形象-基础形象 走向门口。',
        metadata: expect.objectContaining({
          shotCount: 1,
          shots: [
            expect.objectContaining({
              sceneId: 'S01',
              shotId: 'S01-SH01',
              shotType: '中景',
              subject: '阿明',
            }),
          ],
          parseError: 'STORYBOARD_SHOTS_JSON_MISSING',
          parseFallbackMode: 'text-derived',
        }),
      })
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'done',
        message: '分镜提示词生成完成，结构化 JSON 未完全命中，已从文本补齐镜头清单。',
      })
    );
  });

  it('retries safe-mode storyboard generation with a summarized prompt after a policy block', async () => {
    let callCount = 0;
    const prompts: string[] = [];

    streamLLM.mockImplementation(async function* (_systemPrompt: string, userPrompt: string) {
      callCount += 1;
      prompts.push(userPrompt);

      if (callCount === 1) {
        throw new Error('content policy blocked');
      }

      yield `分镜① 4s：时间：夜，场景图片：🖼️山门_0，镜头：中景，缓慢推进，🧑 阿宁-基础形象-基础形象 与同伴交换眼神。

[SHOTS_JSON]
\`\`\`json
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01",
    "shotType": "中景",
    "camera": "缓慢推进",
    "composition": "双人平衡构图",
    "motion": "阿宁与同伴交换眼神",
    "subject": "阿宁、同伴",
    "environment": "山门外",
    "lighting": "冷暖交错环境光",
    "audioHint": "风声轻拂，脚步放缓",
    "videoPrompt": "山门外，中景，缓慢推进，阿宁与同伴交换眼神，冷暖交错环境光，风声轻拂，脚步放缓"
  }
]
\`\`\``;
    });

    const onArtifact = vi.fn();
    const send = vi.fn();

    await runStoryboardGeneration({
      body: {
        scriptText: '1-1 夜 外 山门\n阿宁：他们带着兵器追来了。\n同伴：黑市那边的线人也失联了。',
        visualStyle: 'cinematic realism',
        colorTone: 'warm tone',
        genreLabel: '仙侠悬疑',
        safeMode: true,
      },
      context: {
        requestId: 'req_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        plan: 'free',
      } as never,
      jobId: 'job_1',
      send,
      llmConfig: {} as never,
      onArtifact,
    });

    expect(callCount).toBe(2);
    expect(prompts[1]).toContain('以下内容为安全影视化摘要');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'safety_retry',
      })
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'done',
        message: '安全影视化模式生成完成，已启用二次降敏重试。',
      })
    );
    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'storyboard',
        metadata: expect.objectContaining({
          safeMode: true,
          safetyFallbackApplied: true,
        }),
      })
    );
  });

  it('falls back to a local safe storyboard template when the summary retry is also blocked', async () => {
    streamLLM.mockImplementation(async function* () {
      throw new Error('content policy blocked');
    });

    const onArtifact = vi.fn();
    const send = vi.fn();

    await runStoryboardGeneration({
      body: {
        scriptText: '1-1 夜 外 山门\n阿宁：他们带着兵器追来了。\n同伴：黑市那边的线人也失联了。',
        visualStyle: 'cinematic realism',
        colorTone: 'warm tone',
        genreLabel: '仙侠悬疑',
        safeMode: true,
      },
      context: {
        requestId: 'req_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        plan: 'free',
      } as never,
      jobId: 'job_1',
      send,
      llmConfig: {} as never,
      onArtifact,
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'done',
        message: '安全影视化模式生成完成，已启用本地安全兜底分镜。',
      })
    );
    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'storyboard',
        metadata: expect.objectContaining({
          safeMode: true,
          safetyFallbackApplied: true,
          safetyFallbackMode: 'local-template',
        }),
      })
    );
    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'shot_plan',
        content: expect.stringContaining('"sceneId": "S01"'),
      })
    );
    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'storyboard',
        content: expect.stringMatching(/阿宁|角色A/),
      })
    );
  });

  it('falls back to text-derived shots for 镜头 labels too', async () => {
    streamLLM.mockImplementation(async function* () {
      yield '场景: 客厅\n镜头1 4s：时间：夜，场景图片：🖼️客厅_0，镜头：中景，缓慢推进，🧑 阿明-基础形象-基础形象 走向门口。';
    });

    const onArtifact = vi.fn();

    await runStoryboardGeneration({
      body: {
        scriptText: '1-1 日 内 客厅\n阿明：测试文本',
        visualStyle: 'cinematic realism',
        colorTone: 'warm tone',
        genreLabel: '都市女频',
        safeMode: false,
      },
      context: {
        requestId: 'req_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        plan: 'free',
      } as never,
      jobId: 'job_1',
      send: vi.fn(),
      llmConfig: {} as never,
      onArtifact,
    });

    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          shotCount: 1,
          shots: [
            expect.objectContaining({
              sceneId: 'S01',
              shotId: 'S01-SH01',
              subject: '阿明',
            }),
          ],
          parseFallbackMode: 'text-derived',
        }),
      })
    );
  });

  it('salvages valid structured shots and only backfills invalid ones from text', async () => {
    streamLLM.mockImplementation(async function* () {
      yield `场景: 客厅
分镜① 4s：时间：夜，场景图片：🖼️客厅_0，镜头：中景，缓慢推进，🧑 阿明-基础形象-基础形象 走向门口。
分镜② 3s：时间：夜，场景图片：🖼️客厅_0，镜头：特写，固定机位，🧑 阿明-基础形象-基础形象 回头看向窗外。

[SHOTS_JSON]
\`\`\`json
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01",
    "shotType": "中景",
    "camera": "缓慢推进",
    "composition": "单人主体构图",
    "motion": "阿明走向门口",
    "subject": "阿明",
    "environment": "客厅",
    "lighting": "场景氛围光",
    "audioHint": "环境氛围音",
    "videoPrompt": "客厅，中景，缓慢推进，阿明走向门口，场景氛围光，环境氛围音"
  },
  {
    "sceneId": "S01",
    "shotId": "S01-SH02",
    "shotType": "",
    "camera": "固定机位",
    "composition": "主体特写构图",
    "motion": "阿明回头看向窗外",
    "subject": "阿明",
    "environment": "客厅",
    "lighting": "场景氛围光",
    "audioHint": "环境氛围音",
    "videoPrompt": "客厅，特写，固定机位，阿明回头看向窗外，场景氛围光，环境氛围音"
  }
]
\`\`\``;
    });

    const onArtifact = vi.fn();
    const send = vi.fn();

    await runStoryboardGeneration({
      body: {
        scriptText: '1-1 日 内 客厅\n阿明：测试文本',
        visualStyle: 'cinematic realism',
        colorTone: 'warm tone',
        genreLabel: '都市女频',
        safeMode: false,
      },
      context: {
        requestId: 'req_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        plan: 'free',
      } as never,
      jobId: 'job_1',
      send,
      llmConfig: {} as never,
      onArtifact,
    });

    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          shotCount: 2,
          parseError: 'STORYBOARD_SHOT_FIELD_INVALID:1:shotType',
          parseFallbackMode: 'partial-text-derived',
          invalidShotIndexes: [1],
          invalidShotErrors: ['STORYBOARD_SHOT_FIELD_INVALID:1:shotType'],
          shots: [
            expect.objectContaining({
              shotId: 'S01-SH01',
              shotType: '中景',
              motion: '阿明走向门口',
            }),
            expect.objectContaining({
              shotId: 'S01-SH02',
              shotType: '特写',
              subject: '阿明',
            }),
          ],
        }),
      })
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'done',
        message: '分镜提示词生成完成，部分结构化镜头已保留，其余镜头已从文本补齐。',
      })
    );
  });

  it('rejects storyboard output when the [SHOTS_JSON] block is missing required fields', () => {
    expect(() =>
      parseStoryboardOutput(`[SHOTS_JSON]
\`\`\`json
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01"
  }
]
\`\`\``)
    ).toThrow('STORYBOARD_SHOT_FIELD_INVALID:0:shotType');
  });
});

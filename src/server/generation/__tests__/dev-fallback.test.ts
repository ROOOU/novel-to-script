import { describe, expect, it } from 'vitest';
import {
  runScriptGenerationDevFallback,
  runStoryboardGenerationDevFallback,
} from '@/server/generation/dev-fallback';

const BASE_CONTEXT = {
  requestId: 'job:test',
  traceId: 'job:test',
  clientIp: 'server',
  userAgent: 'worker',
  referer: null,
  locale: null,
  organizationId: 'org_1',
  workspaceId: 'ws_1',
  projectId: 'proj_1',
  userId: 'user_1',
  sessionId: null,
  plan: 'creator' as const,
  source: 'default' as const,
};

describe('local dev generation fallback', () => {
  it('builds script-generation artifacts without an external LLM', async () => {
    const artifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];
    const progress: string[] = [];

    await runScriptGenerationDevFallback({
      body: {
        text: '韩立在荒原边缘停步，察觉远处斗法异动。银月提醒他先观察局势，再决定是否介入。远处灵光再度闪烁，局面变得更紧张。',
        genre: 'xianxia',
        config: {
          genre: 'xianxia',
          episodeCount: 1,
          episodeDuration: '1:00-1:30',
          style: 'highEnergy',
          includeDirectorNotes: true,
        },
      },
      context: BASE_CONTEXT,
      jobId: 'job_script_dev',
      send: () => undefined,
      usageMeter: {
        record: () => undefined,
      },
      onProgress: (entry) => {
        progress.push(entry.currentStep);
      },
      onArtifact: (artifact) => {
        artifacts.push(artifact);
      },
    });

    expect(progress).toContain('done');
    expect(artifacts.map((artifact) => artifact.kind)).toEqual([
      'analysis',
      'story_bible',
      'outline',
      'scene_cards',
      'script',
    ]);
    expect(artifacts[0]?.metadata).toMatchObject({
      devFallback: true,
    });
    expect(artifacts[4]?.content).toContain('第1集');
  });

  it('builds storyboard, shot plan, and prompt pack artifacts from script text', async () => {
    const artifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];

    await runStoryboardGenerationDevFallback({
      body: {
        scriptText: [
          '【本地开发兜底生成】',
          '第1集《荒原异动》',
          '人物：韩立、银月、法士',
          '',
          '1-1 日 外 荒原边缘',
          '动作：韩立在荒原边缘停步，远处灵光忽明忽暗。',
          '韩立：先别动，看看前面到底是谁。',
          '银月：那股气息越来越近了。',
          '转场：切向更近的冲突现场。',
        ].join('\n'),
        visualStyle: 'cinematic realism',
        colorTone: '冷色调',
        genreLabel: '仙侠短剧',
        targetPlatform: 'generic-video',
      },
      context: BASE_CONTEXT,
      jobId: 'job_storyboard_dev',
      send: () => undefined,
      usageMeter: {
        record: () => undefined,
      },
      onProgress: () => undefined,
      onArtifact: (artifact) => {
        artifacts.push(artifact);
      },
    });

    expect(artifacts.map((artifact) => artifact.kind)).toEqual([
      'storyboard',
      'shot_plan',
      'prompt_pack',
    ]);
    expect(artifacts[0]?.metadata).toMatchObject({
      devFallback: true,
      shotCount: 2,
    });

    const shotPlan = JSON.parse(artifacts[1]?.content ?? '[]');
    expect(shotPlan).toHaveLength(2);
    expect(shotPlan[0]).toMatchObject({
      sceneId: 'SCENE-01',
      shotId: 'SHOT-01',
    });
    expect(typeof shotPlan[0]?.videoPrompt).toBe('string');
    expect(artifacts[2]?.content).toContain('Negative Prompt');
  });

  it('normalizes raw novel characters and locations before generating storyboard prompts', async () => {
    const scriptArtifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];
    const storyboardArtifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];

    await runScriptGenerationDevFallback({
      body: {
        text: [
          '慕兰人的队伍一点点的前进，韩立和银月安然的待在车内，过了两天两夜。',
          '但韩立被银月叫醒后，略一施法，这些低阶的法士，自然毫无所获的离开了。',
          '结果，一等到队伍出了慕兰草原，韩立就立刻携带着银月，从另一条路进了荒原，直奔天南而来。',
          '依仗着神识的强大，韩立顺利通过了荒原地段，进入了九国盟的丰原国。',
        ].join('\n'),
        genre: 'xianxia',
        config: {
          genre: 'xianxia',
          episodeCount: 1,
          episodeDuration: '1:00-1:30',
          style: 'highEnergy',
          includeDirectorNotes: true,
        },
      },
      context: BASE_CONTEXT,
      jobId: 'job_script_dev_regression',
      send: () => undefined,
      usageMeter: {
        record: () => undefined,
      },
      onProgress: () => undefined,
      onArtifact: (artifact) => {
        scriptArtifacts.push(artifact);
      },
    });

    const analysis = JSON.parse(
      scriptArtifacts.find((artifact) => artifact.kind === 'analysis')?.content ?? '{}'
    ) as { characters?: Array<{ name: string }> };
    const scriptText = scriptArtifacts.find((artifact) => artifact.kind === 'script')?.content ?? '';

    expect(analysis.characters?.map((character) => character.name)).toEqual(
      expect.arrayContaining(['韩立', '银月'])
    );
    expect(analysis.characters?.map((character) => character.name)).not.toEqual(
      expect.arrayContaining(['但韩立', '本上师', '不少'])
    );
    expect(scriptText).toContain('人物：韩立、银月');
    expect(scriptText).toContain('慕兰草原');
    expect(scriptText).not.toContain('天南而来');

    await runStoryboardGenerationDevFallback({
      body: {
        scriptText,
        visualStyle: 'cinematic realism',
        colorTone: '冷色调',
        genreLabel: '仙侠短剧',
        targetPlatform: 'generic-video',
      },
      context: BASE_CONTEXT,
      jobId: 'job_storyboard_dev_regression',
      send: () => undefined,
      usageMeter: {
        record: () => undefined,
      },
      onProgress: () => undefined,
      onArtifact: (artifact) => {
        storyboardArtifacts.push(artifact);
      },
    });

    const shotPlan = JSON.parse(
      storyboardArtifacts.find((artifact) => artifact.kind === 'shot_plan')?.content ?? '[]'
    ) as Array<{ subject?: string; environment?: string; videoPrompt?: string }>;
    const serializedShotPlan = JSON.stringify(shotPlan);

    expect(serializedShotPlan).toContain('韩立');
    expect(serializedShotPlan).toContain('银月');
    expect(serializedShotPlan).toContain('慕兰草原');
    expect(serializedShotPlan).not.toContain('但韩立');
    expect(serializedShotPlan).not.toContain('天南而来');
  });

  it('does not treat body-part phrases as scene locations in local fallback scripts', async () => {
    const artifacts: Array<{ kind: string; content: string; metadata?: Record<string, unknown> }> = [];

    await runScriptGenerationDevFallback({
      body: {
        text: [
          '林晚在雨夜回到旧宅，发现父亲留下的木匣里藏着一封未寄出的信。',
          '信中提到沈家正在寻找一枚旧钥匙，而那把钥匙正挂在她脖子上。',
          '门外传来脚步声，她关掉台灯，透过窗帘看见沈砚撑伞站在院门口。',
        ].join(''),
        genre: 'urban',
        config: {
          genre: 'urban',
          episodeCount: 1,
          episodeDuration: '1:30-2:00',
          style: 'dramatic',
          includeDirectorNotes: true,
        },
      },
      context: BASE_CONTEXT,
      jobId: 'job_script_dev_location_regression',
      send: () => undefined,
      usageMeter: {
        record: () => undefined,
      },
      onProgress: () => undefined,
      onArtifact: (artifact) => {
        artifacts.push(artifact);
      },
    });

    const scriptText = artifacts.find((artifact) => artifact.kind === 'script')?.content ?? '';
    const sceneHeadings = scriptText
      .split('\n')
      .filter((line) => /^\d+-\d+\s+(日|夜|晨|暮|黄昏)\s+(内|外|内外)\s+/.test(line));

    expect(sceneHeadings.join('\n')).not.toContain('她脖子');
    expect(sceneHeadings.join('\n')).toMatch(/旧宅|院门口|主要场景/);
  });
});

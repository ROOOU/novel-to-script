import { describe, expect, it } from 'vitest';
import type { StoryboardShot } from '@/server/shared/platform/domain';
import { compilePromptPack } from './prompt-compiler';

const SHOT: StoryboardShot = {
  sceneId: 'S01',
  shotId: 'S01-SH01',
  shotType: '中景',
  camera: '低机位跟拍后缓慢推进',
  composition: '人物居中，前景有玻璃反射',
  motion: '女主推开雨夜便利店的门，停顿一秒后抬头看向货架深处',
  subject: '穿米色风衣的女主',
  environment: '雨夜便利店门口',
  lighting: '霓虹灯与室内暖光交错',
  audioHint: '雨声、门铃声和压低的呼吸声同步',
  videoPrompt: '雨夜便利店门口，中景，低机位跟拍后缓慢推进，女主推门进入，霓虹灯反射在玻璃门上',
};

describe('compilePromptPack', () => {
  it('keeps the existing generic prompt pack format by default', () => {
    const [entry] = compilePromptPack([SHOT], {
      visualStyle: '真人写实',
      colorTone: '暖色调',
      genreLabel: '都市女频',
    });

    expect(entry).toMatchObject({
      shotId: 'S01-SH01',
      targetPlatform: 'generic-video',
    });
    expect(entry?.mainPrompt).toContain('镜头类型：中景');
    expect(entry?.mainPrompt).toContain('场景：雨夜便利店门口');
    expect(entry?.copyReadyText).toContain('Negative Prompt');
    expect(entry?.copyReadyText).not.toContain('Seedance 2.0 官方案例式分解');
  });

  it('builds Seedance-ready official-case-style breakdowns', () => {
    const [entry] = compilePromptPack([SHOT], {
      visualStyle: '真人写实',
      colorTone: '暖色调',
      genreLabel: '都市女频',
      targetPlatform: 'seedance',
    });

    expect(entry).toMatchObject({
      shotId: 'S01-SH01',
      targetPlatform: 'seedance',
    });
    expect(entry?.mainPrompt).toContain('T2V prompt：15s短剧分镜');
    expect(entry?.mainPrompt).toContain('低机位跟拍后缓慢推进');
    expect(entry?.mainPrompt).toContain('动作节拍、对白口型和环境声同步');
    expect(entry?.copyReadyText).toContain('Seedance 2.0 官方案例式分解');
    expect(entry?.copyReadyText).toContain('如绑定参考图，可改为 R2V');
    expect(entry?.copyReadyText).toContain('材质/物理细节');
    expect(entry?.negativePrompt).toContain('主体漂移');
    expect(entry?.negativePrompt).toContain('音画不同步');
    expect(entry?.styleHints).toEqual(
      expect.arrayContaining(['Seedance 2.0', '15s多镜头', '音画同步'])
    );
    expect(entry?.safetyNotes).toContain('如使用真人肖像、声音或参考素材，请确认已获得合法授权。');
  });

  it('keeps safety constraints in Seedance safe mode', () => {
    const [entry] = compilePromptPack([SHOT], {
      visualStyle: '真人写实',
      colorTone: '冷色调',
      genreLabel: '悬疑短剧',
      safeMode: true,
      targetPlatform: 'seedance',
    });

    expect(entry?.negativePrompt).toContain('避免血腥、露骨伤害');
    expect(entry?.negativePrompt).toContain('物理运动不连贯');
    expect(entry?.safetyNotes).toEqual(
      expect.arrayContaining([
        '已启用安全影视化降敏，请保持克制表达并避免血腥或过度暴力细节。',
        '如使用真人肖像、声音或参考素材，请确认已获得合法授权。',
      ])
    );
  });
});

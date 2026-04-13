import type {
  PromptPackEntry,
  PromptPackTargetPlatform,
  StoryboardShot,
} from '@/server/shared/platform/domain';

export function compilePromptPack(
  shots: StoryboardShot[],
  input: {
    visualStyle: string;
    colorTone: string;
    genreLabel: string;
    safeMode?: boolean;
    targetPlatform?: PromptPackTargetPlatform;
  }
): PromptPackEntry[] {
  return shots.map((shot) => {
    const styleHints = [input.visualStyle, input.colorTone, input.genreLabel].filter(Boolean);
    const safetyNotes = input.safeMode
      ? ['已启用安全影视化降敏，请保持克制表达并避免血腥或过度暴力细节。']
      : [];
    const mainPrompt = [
      shot.videoPrompt || shot.subject,
      `镜头类型：${shot.shotType || '未指定'}`,
      `场景：${shot.environment || shot.sceneId || '未指定'}`,
      styleHints.length > 0 ? `风格：${styleHints.join(' / ')}` : '',
    ]
      .filter((value) => value && value.trim().length > 0)
      .join('；');
    const negativePrompt = input.safeMode
      ? '避免血腥、露骨伤害、惊悚重口、低俗挑逗、肢体残缺特写。'
      : '避免低清晰度、画面崩坏、额外肢体、文字水印、构图混乱。';

    return {
      shotId: shot.shotId,
      targetPlatform: input.targetPlatform ?? 'generic-video',
      mainPrompt,
      negativePrompt,
      styleHints,
      safetyNotes,
      copyReadyText: [mainPrompt, `Negative Prompt：${negativePrompt}`].join('\n'),
    };
  });
}

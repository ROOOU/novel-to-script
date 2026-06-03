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
  const targetPlatform = input.targetPlatform ?? 'generic-video';

  return shots.map((shot) =>
    targetPlatform === 'seedance'
      ? compileSeedanceEntry(shot, input)
      : compileGenericEntry(shot, input)
  );
}

function compileGenericEntry(
  shot: StoryboardShot,
  input: {
    visualStyle: string;
    colorTone: string;
    genreLabel: string;
    safeMode?: boolean;
    targetPlatform?: PromptPackTargetPlatform;
  }
): PromptPackEntry {
  const styleHints = buildBaseStyleHints(input);
  const safetyNotes = buildSafetyNotes(input.safeMode, false);
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
}

function compileSeedanceEntry(
  shot: StoryboardShot,
  input: {
    visualStyle: string;
    colorTone: string;
    genreLabel: string;
    safeMode?: boolean;
  }
): PromptPackEntry {
  const shotType = readShotValue(shot.shotType, '中景');
  const camera = readShotValue(shot.camera, '缓慢推进');
  const composition = readShotValue(shot.composition, '主体稳定居中构图');
  const subject = readShotValue(shot.subject, '主要人物');
  const environment = readShotValue(shot.environment || shot.sceneId, '主要场景');
  const motion = readShotValue(shot.motion, '角色完成本镜动作并自然衔接下一镜');
  const lighting = readShotValue(shot.lighting, `${input.colorTone || '电影感'}光影`);
  const audioHint = readShotValue(shot.audioHint, '环境声与人物动作同步');
  const sourcePrompt = normalizeInlineText(shot.videoPrompt);
  const styleHints = [
    ...buildBaseStyleHints(input),
    'Seedance 2.0',
    '15s多镜头',
    '音画同步',
  ];
  const safetyNotes = buildSafetyNotes(input.safeMode, true);
  const sceneSetup = sourcePrompt || `${environment}，${shotType}，${camera}，${subject}，${motion}`;
  const mainPrompt = [
    `T2V prompt：15s短剧分镜，${readShotValue(input.genreLabel, '短剧')}。`,
    `开场在${environment}，${camera}，${composition}，用${shotType}建立空间和角色关系。`,
    `主体保持一致：${subject}。`,
    `动作连续性：${motion}；保留上一动作余势，让角色表情、手势和站位自然推进到下一情绪节点。`,
    `画面细节：${sceneSetup}；强调服装、道具、光影反射、材质纹理和动作惯性，避免突然跳切。`,
    `风格：${buildStylePhrase(input)}，${lighting}。`,
    `音频：${audioHint}，动作节拍、对白口型和环境声同步。`,
    `结尾以可接下一镜的动作或表情停顿收束。`,
  ].join('');
  const negativePrompt = [
    input.safeMode
      ? '避免血腥、露骨伤害、惊悚重口、低俗挑逗、肢体残缺特写。'
      : '',
    '避免低清晰度、画面崩坏、额外肢体、手指畸变、脸部崩坏、主体漂移、服装道具前后不一致、文字水印、构图混乱、镜头抖动、突兀跳切、物理运动不连贯、音画不同步、口型错位。',
  ]
    .filter(Boolean)
    .join('');
  const copyReadyText = [
    '【Seedance 2.0 官方案例式分解】',
    '类型：T2V prompt（如绑定参考图，可改为 R2V：角色 @图片 2，场景 @图片 3，道具 @图片 4）',
    '时长：15s，允许单镜内多动作连续调度',
    `主体一致性：${subject}`,
    `场景/环境：${environment}`,
    `镜头语言：${shotType}，${camera}，${composition}`,
    `动作节奏：${motion}`,
    `材质/物理细节：服装、道具、光影反射、空间层次和动作惯性需要连续可信`,
    `光影/风格：${buildStylePhrase(input)}，${lighting}`,
    `音频/对白：${audioHint}；音效、对白口型和动作节拍同步`,
    `结尾衔接：保留动作余势或表情停顿，方便下一镜承接`,
    '',
    mainPrompt,
    `Negative Prompt：${negativePrompt}`,
  ].join('\n');

  return {
    shotId: shot.shotId,
    targetPlatform: 'seedance',
    mainPrompt,
    negativePrompt,
    styleHints,
    safetyNotes,
    copyReadyText,
  };
}

function buildBaseStyleHints(input: {
  visualStyle: string;
  colorTone: string;
  genreLabel: string;
}): string[] {
  return [input.visualStyle, input.colorTone, input.genreLabel].filter(Boolean);
}

function buildSafetyNotes(safeMode: boolean | undefined, seedance: boolean): string[] {
  return [
    safeMode ? '已启用安全影视化降敏，请保持克制表达并避免血腥或过度暴力细节。' : '',
    seedance ? '如使用真人肖像、声音或参考素材，请确认已获得合法授权。' : '',
  ].filter(Boolean);
}

function buildStylePhrase(input: {
  visualStyle: string;
  colorTone: string;
  genreLabel: string;
}): string {
  const styleHints = buildBaseStyleHints(input);
  return styleHints.length > 0 ? styleHints.join(' / ') : '电影感写实短剧';
}

function readShotValue(value: string | undefined, fallback: string): string {
  const normalized = normalizeInlineText(value);
  return normalized || fallback;
}

function normalizeInlineText(value: string | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

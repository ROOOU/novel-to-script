import { cleanText } from '@/lib/preprocessor';
import {
  GENRE_LABELS,
  type Genre,
  type NovelAnalysis,
  type OutlineEntry,
  type ScriptStyle,
} from '@/lib/types';
import { isDevAccessEnabled } from '@/server/auth/dev-access';
import { buildSceneCards, buildStoryBible } from '@/server/story-engine/story-bible';
import {
  buildScriptUsageEvent,
  type ScriptGenerationExecutionOptions,
} from '@/server/script-generation/application/types';
import type { PromptPackTargetPlatform, StoryboardShot } from '@/server/shared/platform';
import { extractCharacters, extractScenes } from '@/server/storyboard/application/extract-helpers';
import { resolveStoryboardScriptSource } from '@/server/storyboard/application/run-storyboard-generation';
import {
  buildStoryboardUsageEvent,
  type StoryboardGenerationExecutionOptions,
} from '@/server/storyboard/application/types';
import { compilePromptPack } from '@/server/storyboard/prompt-compiler';
import { buildStoryChunks } from '@/server/story-engine/chunking';
import { evaluateStoryComplexity } from '@/server/story-engine/complexity';

const DEV_FALLBACK_REASON = 'LLM_CONFIG_MISSING';
const DEV_FALLBACK_FLAG = 'local-dev-fallback';
const DEV_FALLBACK_TRUTHY_VALUES = ['1', 'true', 'yes', 'on'];
const NARRATIVE_STOP_WORDS = new Set([
  '他们',
  '我们',
  '这里',
  '那里',
  '此时',
  '之后',
  '结果',
  '时候',
  '期间',
  '已经',
  '还是',
  '一个',
  '一些',
  '一位',
  '一种',
  '一时',
  '两天',
  '两夜',
  '数日',
  '数丈',
  '其中',
  '前方',
  '后退',
  '双方',
  '真正',
  '应该',
  '存在',
  '模样',
  '样子',
  '事情',
  '机会',
  '麻烦',
  '队伍',
  '法士',
  '修士',
  '老者',
  '女子',
  '车辆',
  '灵光',
  '黄袍',
  '光头',
  '狂风',
  '荒原',
  '边缘',
  '丰原国',
  '九国盟',
  '慕兰人',
  '慕兰族',
  '上师',
  '不少',
]);
const CHARACTER_PREFIX_TOKENS = [
  '那名',
  '一名',
  '一位',
  '这名',
  '这位',
  '但',
  '却',
  '又',
  '仍',
  '还',
  '再',
  '便',
  '并',
  '将',
  '把',
  '被',
  '让',
  '使',
  '令',
  '向',
  '对',
  '于',
  '从',
  '由',
  '和',
  '与',
  '及',
  '同',
  '跟',
  '其',
  '本',
];
const CHARACTER_SUFFIX_TOKENS = [
  '而来',
  '安然',
  '叫醒',
  '立刻',
  '出来',
  '进去',
  '之后',
  '身上',
  '相貌',
  '模样',
  '几人',
];
const LOCATION_PREFIX_TOKENS = [
  '一座',
  '一处',
  '几处',
  '数处',
  '这座',
  '那座',
  '这处',
  '那处',
  '另一条路',
  '另一处',
  '偏僻',
];
const LOCATION_SUFFIX_TOKENS = ['而来', '之地', '地段', '附近', '一侧', '方向', '地界'];
const LOCATION_EDGE_SUFFIX_CHARS = new Set(['上', '下', '处', '侧']);
const LOCATION_KEEP_VALUES = new Set(['车内']);
const LOCATION_BODY_PART_PATTERN = /(?:脖子|身上|手中|手里|怀里|口袋|肩头|肩上|脸上|眼前|心里|胸口|腰间)/u;
const CHARACTER_CONTEXT_PATTERNS = [
  /([\u4e00-\u9fff]{2,3})和([\u4e00-\u9fff]{2,3})(?=(?:安然|并|都|在|走|立|，|。|；|、|\n|$))/gu,
  /([\u4e00-\u9fff]{2,3})与([\u4e00-\u9fff]{2,3})/gu,
  /([\u4e00-\u9fff]{2,3})被([\u4e00-\u9fff]{2,3})(?=(?:叫醒|提醒|发现|救下|带走|逼退|围住|抓住|追上|，|。|；|、|\n|$))/gu,
  /(?:^|[，。；！？\n])(?:但|却|仍|还|再|又|便|并)?([\u4e00-\u9fff]{2,3})(?=(?:就|却|仍|还是|口中|脸上|周身|满脸|心中|神色|目光|觉得|看出|望去|自语|说道|停步|提醒|察觉|观察|判断|联手|拒敌|施法|争斗|驱使|释放|进入|离开|飞遁|携带|感应|一眼))/gu,
];
const LOCATION_CONTEXT_PATTERNS = [
  /(?:在|于|进了|进入|来到|回到|直奔|飞过|出了|通过|驻扎在|驻扎着|赶往|赶到)(?:了)?([^，。；、“”\s]{2,12})/gu,
  /(?:^|[，。；！？\n])([\u4e00-\u9fff]{2,8}(?:车内|草原|荒原|小山|灵山|洞府|殿内|宫内|山谷|山脉|国|城|山|谷|宫|殿|原|盟))/gu,
];
const FALLBACK_STYLE_HINTS: Record<ScriptStyle, string> = {
  dramatic: '情绪拉满，关系冲突明确',
  comedic: '节奏轻巧，反应更鲜明',
  suspense: '压迫感持续，信息逐步揭露',
  sweet: '关系暧昧，互动更柔和',
  dark: '氛围压低，危险感更强',
  highEnergy: '节奏更快，动作更利落',
};
const FALLBACK_COLOR_LIGHTING: Record<string, string> = {
  冷色调: '冷色天光与高反差边缘光',
  暖色调: '暖色环境光与柔和侧逆光',
  夜色蓝调: '夜色蓝调与局部轮廓光',
};

interface DevFallbackEnv {
  NODE_ENV?: string;
  NOVELSCRIPT_ENABLE_DEV_AUTH?: string;
  NOVELSCRIPT_ENABLE_DEV_GENERATION_FALLBACK?: string;
}

interface StorySentenceChunk {
  titleSeed: string;
  sentences: string[];
}

interface SceneHeading {
  raw: string;
  timeOfDay: string;
  stageType: string;
  location: string;
}

interface ScriptSceneBlock {
  heading: SceneHeading;
  lines: string[];
}

export const DEV_FALLBACK_MODEL_NAME = 'local-dev-fallback';

export function isDevGenerationFallbackEnabled(env: DevFallbackEnv = process.env) {
  if (env.NODE_ENV === 'production') {
    return false;
  }

  return (
    isTruthy(env.NOVELSCRIPT_ENABLE_DEV_GENERATION_FALLBACK) ||
    isDevAccessEnabled(env)
  );
}

export function shouldUseDevGenerationFallback(input: {
  kind: string;
  llmConfigError: string | null;
  env?: DevFallbackEnv;
}) {
  return (
    (input.kind === 'script-generation' || input.kind === 'storyboard-generation') &&
    Boolean(input.llmConfigError) &&
    isDevGenerationFallbackEnabled(input.env)
  );
}

export async function runScriptGenerationDevFallback(
  input: Pick<
    ScriptGenerationExecutionOptions,
    'body' | 'context' | 'jobId' | 'send' | 'usageMeter' | 'onProgress' | 'onArtifact'
  >
) {
  const cleanedText = cleanText(input.body.text);
  const complexityInfo = input.body.complexityInfo ?? evaluateStoryComplexity(cleanedText);
  const executionMode = input.body.executionMode ?? complexityInfo.recommendedExecutionMode;
  const storyChunks = buildStoryChunks(cleanedText, complexityInfo);

  input.usageMeter?.record(
    buildScriptUsageEvent(input.context, cleanedText.length, 'character', {
      phase: 'request_received',
      episodeCount: input.body.config.episodeCount,
      jobId: input.jobId,
      devFallback: true,
    })
  );
  input.usageMeter?.record(
    buildScriptUsageEvent(input.context, 1, 'job', {
      phase: 'job_started',
      jobId: input.jobId,
      devFallback: true,
    })
  );

  input.send({
    step: 'preprocessing',
    message: '未检测到 LLM Provider，已切换到本地开发兜底生成...',
  });
  await input.onProgress?.({
    progress: 5,
    currentStep: 'preprocessing',
    outputSummary: 'local dev fallback',
  });

  const analysis =
    input.body.analysis ?? buildDevFallbackNovelAnalysis(cleanedText, input.body.genre);
  const analysisJson = JSON.stringify(analysis, null, 2);

  input.send({
    step: 'analyzed',
    message: '本地开发分析已生成',
    data: analysisJson,
  });
  await input.onArtifact?.({
    kind: 'analysis',
    title: '小说分析',
    format: 'application/json',
    content: analysisJson,
    metadata: buildDevFallbackMetadata({
      executionMode,
      complexityInfo,
      chunkCount: storyChunks.length,
      analysisStrategy: DEV_FALLBACK_FLAG,
    }),
  });
  await input.onProgress?.({
    progress: 30,
    currentStep: 'analyzed',
    outputSummary: 'dev fallback analysis ready',
  });

  const storyBible = buildStoryBible({
    analysis,
    style: input.body.config.style,
  });
  await input.onArtifact?.({
    kind: 'story_bible',
    title: '故事圣经',
    format: 'application/json',
    content: JSON.stringify(storyBible, null, 2),
    metadata: buildDevFallbackMetadata({
      executionMode,
      complexityInfo,
      sourceKind: 'analysis',
      characterCount: storyBible.characters.length,
    }),
  });

  input.send({
    step: 'outlining',
    message: '正在生成本地开发分集大纲...',
  });
  await input.onProgress?.({
    progress: 40,
    currentStep: 'outlining',
    outputSummary: 'dev fallback outlining',
  });

  const outlineEntries = buildDevFallbackOutlineEntries({
    text: cleanedText,
    analysis,
    episodeCount: input.body.config.episodeCount,
  });
  const outlineJson = JSON.stringify(outlineEntries, null, 2);

  input.send({
    step: 'outlined',
    message: '本地开发大纲已生成',
    data: outlineJson,
  });
  await input.onArtifact?.({
    kind: 'outline',
    title: '分集大纲',
    format: 'application/json',
    content: outlineJson,
    metadata: buildDevFallbackMetadata({
      executionMode,
      complexityInfo,
      chunkCount: storyChunks.length,
      outlineStrategy: DEV_FALLBACK_FLAG,
    }),
  });

  const sceneCards = buildSceneCards({
    analysis,
    outline: outlineEntries,
  });
  await input.onArtifact?.({
    kind: 'scene_cards',
    title: '场景卡',
    format: 'application/json',
    content: JSON.stringify(sceneCards, null, 2),
    metadata: buildDevFallbackMetadata({
      executionMode,
      complexityInfo,
      sourceKind: 'outline',
      sceneCount: sceneCards.length,
    }),
  });

  const locations = inferLocationsFromText(cleanedText);
  const episodeCount = input.body.config.episodeCount;

  for (let episode = 1; episode <= episodeCount; episode += 1) {
    const outlineEntry = outlineEntries[episode - 1];
    input.send({
      step: 'generating',
      message: `正在生成第 ${episode}/${episodeCount} 集本地开发剧本...`,
      episode,
    });
    await input.onProgress?.({
      progress: Math.min(95, 55 + (episode - 1) * (35 / Math.max(episodeCount, 1))),
      currentStep: `generating_episode_${episode}`,
      outputSummary: `dev fallback episode ${episode}/${episodeCount}`,
    });

    const scriptContent = buildDevFallbackEpisodeScript({
      episode,
      outlineEntry,
      characters: analysis.characters.map((character) => character.name),
      locations,
      style: input.body.config.style,
      genre: input.body.genre,
    });

    input.send({
      step: 'episode_done',
      episode,
      content: scriptContent,
    });
    await input.onArtifact?.({
      kind: 'script',
      title: `第${episode}集剧本`,
      format: 'text/plain',
      content: scriptContent,
      metadata: buildDevFallbackMetadata({
        episode,
        executionMode,
        complexityInfo,
        chunkCount: storyChunks.length,
        scriptStrategy: DEV_FALLBACK_FLAG,
        sourceChunkIndex: Math.min(storyChunks.length, episode),
      }),
    });
  }

  input.usageMeter?.record(
    buildScriptUsageEvent(input.context, 1, 'request', {
      phase: 'job_completed',
      episodeCount,
      jobId: input.jobId,
      devFallback: true,
    })
  );
  await input.onProgress?.({
    progress: 100,
    currentStep: 'done',
    outputSummary: `Generated ${episodeCount} episodes (dev fallback)`,
  });
  input.send({
    step: 'done',
    message: '本地开发剧本生成完成！',
  });
}

export async function runStoryboardGenerationDevFallback(
  input: Pick<
    StoryboardGenerationExecutionOptions,
    'body' | 'context' | 'jobId' | 'send' | 'usageMeter' | 'onProgress' | 'onArtifact'
  >
) {
  const source = await resolveStoryboardScriptSource(input.body, {
    organizationId: input.context.organizationId,
    workspaceId: input.context.workspaceId,
    projectId: input.context.projectId,
  });
  const scriptText = source.scriptText;
  const visualStyle = input.body.visualStyle || '真人写实';
  const colorTone = input.body.colorTone || '暖色调';
  const genreLabel = input.body.genreLabel || '短剧原型';
  const characters = normalizeCharacters(extractCharacters(scriptText), scriptText);
  const scenes = resolveStoryboardSceneList(scriptText);

  input.usageMeter?.record(
    buildStoryboardUsageEvent(input.context, scriptText.length, 'character', {
      phase: 'request_received',
      jobId: input.jobId,
      devFallback: true,
    })
  );
  input.usageMeter?.record(
    buildStoryboardUsageEvent(input.context, 1, 'job', {
      phase: 'job_started',
      jobId: input.jobId,
      devFallback: true,
    })
  );

  input.send({
    step: 'parsing',
    message: '未检测到 LLM Provider，正在生成本地开发分镜...',
  });
  await input.onProgress?.({
    progress: 15,
    currentStep: 'parsing',
    outputSummary: 'dev fallback storyboard parsing',
  });

  input.send({
    step: 'parsed',
    message: `识别到 ${characters.length} 个角色，${scenes.length} 个场景`,
    characters,
    scenes,
  });
  await input.onProgress?.({
    progress: 35,
    currentStep: 'parsed',
    outputSummary: `characters:${characters.length};scenes:${scenes.length};devFallback:true`,
  });

  const shots = buildDevFallbackStoryboardShots({
    scriptText,
    characters,
    scenes,
    visualStyle,
    colorTone,
    genreLabel,
  });
  const storyboardText = buildDevFallbackStoryboardText(shots);
  const sharedMetadata = buildDevFallbackMetadata({
    sourceScriptArtifactIds: source.sourceScriptArtifactIds,
    visualStyle,
    colorTone,
    genreLabel,
    shotCount: shots.length,
  });

  input.send({
    step: 'done',
    message: '本地开发分镜生成完成！',
    content: storyboardText,
  });
  await input.onArtifact?.({
    kind: 'storyboard',
    title: '分镜提示词',
    format: 'text/plain',
    content: storyboardText,
    metadata: sharedMetadata,
  });
  await input.onArtifact?.({
    kind: 'shot_plan',
    title: '结构化镜头计划',
    format: 'application/json',
    content: JSON.stringify(shots, null, 2),
    metadata: {
      ...sharedMetadata,
      downloadFilename: 'shot-plan.json',
    },
  });
  await input.onArtifact?.({
    kind: 'prompt_pack',
    title: '视频提示词包',
    format: 'application/json',
    content: JSON.stringify(
      compilePromptPack(shots, {
        visualStyle,
        colorTone,
        genreLabel,
        safeMode: input.body.safeMode,
        targetPlatform: input.body.targetPlatform as PromptPackTargetPlatform | undefined,
      }),
      null,
      2
    ),
    metadata: {
      ...sharedMetadata,
      targetPlatform: input.body.targetPlatform ?? 'generic-video',
      downloadFilename: 'prompt-pack.json',
    },
  });
  input.usageMeter?.record(
    buildStoryboardUsageEvent(input.context, 1, 'request', {
      phase: 'job_completed',
      jobId: input.jobId,
      devFallback: true,
    })
  );
  await input.onProgress?.({
    progress: 100,
    currentStep: 'done',
    outputSummary: `storyboard generated;shots:${shots.length};devFallback:true`,
  });
}

function buildDevFallbackNovelAnalysis(text: string, genre: Genre): NovelAnalysis {
  const characters = normalizeCharacters([], text);
  const sentences = splitNarrativeSentences(text);
  const locations = inferLocationsFromText(text);
  const storySummary = sentences.slice(0, 4).join(' ');
  const climaxCandidates = sentences.slice(-2);
  const leadingCharacters = characters.slice(0, 3);

  return {
    title: buildFallbackTitle(storySummary, genre),
    genre,
    characters: leadingCharacters.map((name, index) => ({
      name,
      description:
        index === 0
          ? `${name}是当前段落里推动局势前进的核心人物。`
          : index === 1
            ? `${name}与主角形成协同或牵制关系，影响现场判断。`
            : `${name}代表外部压力或未知变量，抬高叙事张力。`,
      personality:
        index === 0
          ? '克制、敏锐、在压力下仍保持判断力'
          : index === 1
            ? '观察细致、回应迅速、善于补充信息'
            : '态度强硬、行动果断、制造不确定性',
      speechStyle:
        index === 0
          ? '台词简短，偏命令式和判断式'
          : index === 1
            ? '多用追问和提醒，强化配合感'
            : '语气强势，偏压迫和试探',
      relationships: leadingCharacters
        .filter((candidate) => candidate !== name)
        .map((candidate) => `${name}与${candidate}之间存在持续拉扯`)
        .slice(0, 2),
    })),
    plotSummary:
      storySummary ||
      `${GENRE_LABELS[genre]}故事进入关键节点，人物关系与外部局势同步升温。`,
    keyConflicts: [
      locations[0]
        ? `主角必须在${locations[0]}的高压局势中判断是否介入。`
        : '主角必须在高压局势中判断是否主动介入。',
      leadingCharacters.length >= 2
        ? `${leadingCharacters[0]}与${leadingCharacters[1]}对当前风险的判断存在微妙差异。`
        : '人物之间的信息差持续制造紧张感。',
      '外部动静不断放大，迫使角色提前做出选择。',
    ],
    climaxPoints: climaxCandidates.length > 0 ? climaxCandidates : ['局势突然升级，后续行动被迫提前展开。'],
    emotionalBeats: [
      '先压住情绪，观察异动',
      '关系信任在紧张环境中被重新确认',
      '最后一刻出现新的变数，悬念被抬高',
    ],
  };
}

function buildDevFallbackOutlineEntries(input: {
  text: string;
  analysis: NovelAnalysis;
  episodeCount: number;
}): OutlineEntry[] {
  const sentences = splitNarrativeSentences(input.text);
  const chunks = chunkSentences(sentences, input.episodeCount);
  const locations = inferLocationsFromText(input.text);

  return chunks.map((chunk, index) => {
    const episodeNumber = index + 1;
    const summary = chunk.sentences.slice(0, 3).join(' ') || input.analysis.plotSummary;
    const keyEvents = chunk.sentences.slice(0, 3);
    const titleSeed = chunk.titleSeed || locations[index] || `局势推进 ${episodeNumber}`;

    return {
      episodeNumber,
      title: `第${episodeNumber}集·${titleSeed}`,
      summary,
      keyEvents: keyEvents.length > 0 ? keyEvents : [summary],
      hook:
        chunk.sentences.at(-1) ||
        input.analysis.climaxPoints[index] ||
        '新的变数突然出现，人物必须立刻做出选择。',
    };
  });
}

function buildDevFallbackEpisodeScript(input: {
  episode: number;
  outlineEntry: OutlineEntry;
  characters: string[];
  locations: string[];
  style: ScriptStyle;
  genre: Genre;
}) {
  const cast = input.characters.slice(0, 3);
  const sceneLocations = resolveEpisodeLocations(input.locations, input.episode);
  const styleHint = FALLBACK_STYLE_HINTS[input.style];
  const lead = cast[0] ?? '主角';
  const partner = cast[1] ?? '同伴';
  const pressure = cast[2] ?? '对手';
  const genreLabel = GENRE_LABELS[input.genre];
  const scenes = [
    buildEpisodeSceneBlock({
      episode: input.episode,
      scene: 1,
      timeOfDay: '日',
      stageType: '外',
      location: sceneLocations[0],
      action: input.outlineEntry.summary,
      lead,
      partner,
      dialogueA: `${styleHint}，我们先看清局势再决定下一步。`,
      dialogueB: `现在所有线索都指向这里，不能再等了。`,
    }),
    buildEpisodeSceneBlock({
      episode: input.episode,
      scene: 2,
      timeOfDay: '日',
      stageType: '内',
      location: sceneLocations[1],
      action: input.outlineEntry.keyEvents.join('；'),
      lead,
      partner: pressure,
      dialogueA: `这不是偶然，真正的压力现在才开始。`,
      dialogueB: `你已经被卷进来了，接下来没有退路。`,
    }),
    buildEpisodeSceneBlock({
      episode: input.episode,
      scene: 3,
      timeOfDay: '夜',
      stageType: '外',
      location: sceneLocations[2],
      action: input.outlineEntry.hook,
      lead,
      partner,
      dialogueA: `只要再晚一步，局面就会彻底失控。`,
      dialogueB: `那就现在出手，把主动权拿回来。`,
    }),
  ];

  return [
    `【本地开发兜底生成｜${genreLabel}】`,
    `第${input.episode}集《${input.outlineEntry.title.replace(/^第\d+集·?/, '')}》`,
    `人物：${cast.join('、') || '主角、对手'}`,
    '',
    ...scenes,
    `本集钩子：${input.outlineEntry.hook}`,
    `下集预告：${lead}必须在更高风险的局势里继续推进选择。`,
  ].join('\n');
}

function buildEpisodeSceneBlock(input: {
  episode: number;
  scene: number;
  timeOfDay: string;
  stageType: string;
  location: string;
  action: string;
  lead: string;
  partner: string;
  dialogueA: string;
  dialogueB: string;
}) {
  return [
    `${input.episode}-${input.scene} ${input.timeOfDay} ${input.stageType} ${input.location}`,
    `动作：${normalizeSentence(input.action, 48)}`,
    `${input.lead}：${input.dialogueA}`,
    `${input.partner}：${input.dialogueB}`,
    '转场：切向下一处冲突更强的空间。',
    '',
  ].join('\n');
}

function buildDevFallbackStoryboardShots(input: {
  scriptText: string;
  characters: string[];
  scenes: string[];
  visualStyle: string;
  colorTone: string;
  genreLabel: string;
}) {
  const sceneBlocks = extractScriptSceneBlocks(input.scriptText);
  const usableScenes =
    sceneBlocks.length > 0
      ? sceneBlocks.map((block) => block.heading.location)
      : input.scenes;
  const scenes = usableScenes.length > 0 ? usableScenes.slice(0, 3) : ['主要场景'];
  const characters = input.characters.length > 0 ? input.characters : ['主角', '同伴'];
  const lighting = FALLBACK_COLOR_LIGHTING[input.colorTone] ?? `${input.colorTone}电影感光影`;
  const audioHint = input.genreLabel.includes('仙') ? '风声、衣摆摩擦与远处灵力轰鸣' : '环境底噪、脚步声与压低的人物对白';
  const shots: StoryboardShot[] = [];

  scenes.forEach((scene, sceneIndex) => {
    const primary = characters[sceneIndex % characters.length] ?? '主角';
    const secondary = characters[(sceneIndex + 1) % characters.length] ?? primary;
    const sceneId = `SCENE-${String(sceneIndex + 1).padStart(2, '0')}`;
    const baseDescription =
      sceneBlocks[sceneIndex]?.lines.find((line) => line.startsWith('动作：'))?.replace(/^动作：/, '').trim() ??
      `${primary}在${scene}里观察局势变化。`;

    shots.push({
      sceneId,
      shotId: `SHOT-${String(shots.length + 1).padStart(2, '0')}`,
      shotType: '中景',
      camera: '缓慢推进',
      composition: '竖屏单人主体构图',
      motion: `${primary}停步观察周围变化，情绪保持克制`,
      subject: `${primary}在${scene}判断下一步行动`,
      environment: scene,
      lighting,
      audioHint,
      videoPrompt: [
        scene,
        input.visualStyle,
        input.genreLabel,
        '竖屏中景',
        '缓慢推进',
        `${primary}在现场观察局势`,
        normalizeSentence(baseDescription, 36),
        lighting,
      ].join('，'),
    });
    shots.push({
      sceneId,
      shotId: `SHOT-${String(shots.length + 1).padStart(2, '0')}`,
      shotType: '特写',
      camera: '固定机位',
      composition: secondary === primary ? '竖屏人物特写构图' : '双人关系特写构图',
      motion: `${primary}与${secondary}交换关键判断，情绪张力上升`,
      subject: `${primary}与${secondary}在高压局势下形成关系拉扯`,
      environment: scene,
      lighting,
      audioHint,
      videoPrompt: [
        scene,
        input.visualStyle,
        input.genreLabel,
        '竖屏特写',
        '固定机位',
        `${primary}与${secondary}对视，压抑张力持续抬升`,
        input.colorTone,
        lighting,
      ].join('，'),
    });
  });

  return shots;
}

function buildDevFallbackStoryboardText(shots: StoryboardShot[]) {
  const groupedByScene = new Map<string, StoryboardShot[]>();
  for (const shot of shots) {
    const sceneShots = groupedByScene.get(shot.sceneId) ?? [];
    sceneShots.push(shot);
    groupedByScene.set(shot.sceneId, sceneShots);
  }

  const lines = ['【本地开发兜底分镜】'];
  for (const [sceneId, sceneShots] of groupedByScene.entries()) {
    const sceneName = sceneShots[0]?.environment ?? '主要场景';
    lines.push(`${sceneId}｜${sceneName}`);
    sceneShots.forEach((shot) => {
      lines.push(
        `${shot.shotId}｜${shot.shotType}｜${shot.camera}｜${shot.subject}｜${shot.motion}`
      );
    });
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildDevFallbackMetadata(extra: Record<string, unknown> = {}) {
  return {
    devFallback: true,
    fallbackReason: DEV_FALLBACK_REASON,
    fallbackSource: DEV_FALLBACK_FLAG,
    ...extra,
  };
}

function buildFallbackTitle(summary: string, genre: Genre) {
  const compact = normalizeSentence(summary, 18).replace(/[。！？]+$/g, '');
  return compact || `${GENRE_LABELS[genre]}原型故事`;
}

function normalizeCharacters(initial: string[], text: string) {
  const normalizedInitial = Array.from(
    new Set(
      initial
        .map((value) => normalizeCharacterCandidate(value))
        .filter((value) => isLikelyCharacterToken(value))
    )
  );
  if (normalizedInitial.length >= 2) {
    return normalizedInitial.slice(0, 4);
  }

  const characterSet = new Set(normalizedInitial);
  const narrativeCandidates = collectNarrativeCharacterCandidates(text);

  const counts = new Map<string, number>();
  for (const candidate of narrativeCandidates) {
    counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }

  Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], 'zh-CN');
    })
    .slice(0, 6)
    .forEach(([candidate, count]) => {
      if (count >= 2) {
        characterSet.add(candidate);
      }
    });

  const normalized = Array.from(characterSet).slice(0, 4);
  return normalized.length > 0 ? normalized : ['主角', '同伴', '对手'];
}

function inferLocationsFromText(text: string) {
  const matches = LOCATION_CONTEXT_PATTERNS.flatMap((pattern) =>
    Array.from(text.matchAll(pattern)).map((match) => normalizeLocationCandidate(match[1] ?? ''))
  ).filter((value) => isLikelyLocationToken(value));

  const unique = Array.from(new Set(matches));
  return unique.length > 0 ? unique.slice(0, 6) : ['主要场景', '临时据点', '冲突现场'];
}

function splitNarrativeSentences(text: string) {
  return text
    .split(/(?:\n{2,}|(?<=[。！？!?]))/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function chunkSentences(sentences: string[], episodeCount: number): StorySentenceChunk[] {
  const safeSentences = sentences.length > 0 ? sentences : ['故事进入关键节点，人物关系与局势同时升温。'];
  const chunkSize = Math.max(1, Math.ceil(safeSentences.length / Math.max(episodeCount, 1)));
  const chunks: StorySentenceChunk[] = [];

  for (let index = 0; index < episodeCount; index += 1) {
    const start = index * chunkSize;
    const slice = safeSentences.slice(start, start + chunkSize);
    const fallbackSentence = safeSentences[Math.min(index, safeSentences.length - 1)] ?? safeSentences[0];
    const resolvedSlice = slice.length > 0 ? slice : [fallbackSentence];
    chunks.push({
      titleSeed: normalizeSentence(resolvedSlice[0], 10).replace(/[。！？]+$/g, ''),
      sentences: resolvedSlice,
    });
  }

  return chunks;
}

function resolveEpisodeLocations(locations: string[], episode: number) {
  const fallbackLocations = locations.length > 0 ? locations : ['主要场景', '临时据点', '冲突现场'];
  return Array.from({ length: 3 }, (_, index) => fallbackLocations[(episode + index - 1) % fallbackLocations.length]);
}

function normalizeSentence(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength)}...`;
}

function resolveStoryboardSceneList(scriptText: string) {
  const extracted = extractScenes(scriptText);
  if (extracted.length > 0) {
    return extracted;
  }

  return inferLocationsFromText(scriptText);
}

function extractScriptSceneBlocks(scriptText: string): ScriptSceneBlock[] {
  const lines = scriptText.split('\n');
  const blocks: ScriptSceneBlock[] = [];
  let currentHeading: SceneHeading | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentHeading) {
      buffer = [];
      return;
    }

    blocks.push({
      heading: currentHeading,
      lines: buffer.map((line) => line.trim()).filter(Boolean),
    });
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^(\d+)-(\d+)\s+(日|夜|晨|暮|黄昏)\s+(内|外|内外)\s+(.+)$/);
    if (match) {
      flush();
      currentHeading = {
        raw: line,
        timeOfDay: match[3] ?? '日',
        stageType: match[4] ?? '外',
        location: match[5]?.trim() ?? '主要场景',
      };
      continue;
    }

    if (currentHeading) {
      buffer.push(line);
    }
  }

  flush();
  return blocks;
}

function isTruthy(value: string | undefined) {
  if (!value) {
    return false;
  }

  return DEV_FALLBACK_TRUTHY_VALUES.includes(value.trim().toLowerCase());
}

function isLikelyCharacterToken(value: string) {
  return (
    value.length >= 2 &&
    value.length <= 4 &&
    !NARRATIVE_STOP_WORDS.has(value) &&
    !/^(?:这个|那个|其中|前方|后方|局势|期间|一下|一路|一位|一名|一点点|上师|法士|修士|老者|女子)$/.test(value) &&
    !/[的了着过]/.test(value) &&
    !/(?:队伍|车辆|马车|羽扇|狂风|灵光|凡人)$/.test(value)
  );
}

function isLikelyLocationToken(value: string) {
  return (
    value.length >= 2 &&
    value.length <= 8 &&
    !NARRATIVE_STOP_WORDS.has(value) &&
    !/^(?:这里|那里|这边|那边|这时|此时|这期间|期间|一下|一眼|局势|队伍|法士|修士)$/.test(value) &&
    !/^[他她它其]/u.test(value) &&
    !LOCATION_BODY_PART_PATTERN.test(value) &&
    !/[看说想觉判断观察对视]/.test(value) &&
    !/[的一了着过]/.test(value)
  );
}

function collectNarrativeCharacterCandidates(text: string) {
  return CHARACTER_CONTEXT_PATTERNS.flatMap((pattern) =>
    Array.from(text.matchAll(pattern)).flatMap((match) =>
      match
        .slice(1)
        .map((value) => normalizeCharacterCandidate(value ?? ''))
        .filter((value) => isLikelyCharacterToken(value))
    )
  );
}

function normalizeCharacterCandidate(value: string) {
  let normalized = value.replace(/[，。；、“”"'（）()\s]/g, '').trim();
  normalized = stripEdgeTokens(normalized, CHARACTER_PREFIX_TOKENS, CHARACTER_SUFFIX_TOKENS);

  while (normalized.length > 2 && /^[一二三四五六七八九十百千万几两名位的了]/u.test(normalized)) {
    normalized = normalized.slice(1);
  }

  while (
    normalized.length > 2 &&
    /[的了着过来去上下中内外前后间处旁边时里]/u.test(normalized.slice(-1))
  ) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized.endsWith('老者子') && normalized.length > 3) {
    normalized = `${normalized.slice(0, -1)}`;
  }

  return normalized;
}

function normalizeLocationCandidate(value: string) {
  let normalized = value.replace(/[，。；、“”"'（）()\s]/g, '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.includes('的')) {
    normalized = normalized.split('的').at(-1) ?? normalized;
  }

  normalized = stripEdgeTokens(normalized, LOCATION_PREFIX_TOKENS, LOCATION_SUFFIX_TOKENS);
  normalized = normalized.replace(/^了/u, '');
  normalized = normalized.replace(/^(?:几处|数处|一座|一处|那座|这座|那处|这处)/u, '');

  while (
    normalized.length > 2 &&
    LOCATION_EDGE_SUFFIX_CHARS.has(normalized.slice(-1)) &&
    !LOCATION_KEEP_VALUES.has(normalized)
  ) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function stripEdgeTokens(value: string, prefixes: string[], suffixes: string[]) {
  let normalized = value;
  let changed = true;

  while (changed) {
    changed = false;

    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix) && normalized.length - prefix.length >= 2) {
        normalized = normalized.slice(prefix.length);
        changed = true;
      }
    }

    for (const suffix of suffixes) {
      if (normalized.endsWith(suffix) && normalized.length - suffix.length >= 2) {
        normalized = normalized.slice(0, -suffix.length);
        changed = true;
      }
    }
  }

  return normalized;
}

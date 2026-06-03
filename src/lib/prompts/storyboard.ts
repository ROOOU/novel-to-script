import { Genre } from '@/lib/types';

type StoryboardTargetPlatform = 'generic-video' | 'seedance';

/**
 * 分镜提示词 Prompt 模板
 * 将剧本场景拆分为视频分镜，生成包含镜头、角色、台词、音色、运镜的完整提示词
 */

/** 画面风格选项 */
export const VISUAL_STYLES = [
  '真人写实',
  '动画风格',
  '水墨国风',
  '赛博朋克',
  '电影质感',
] as const;

export const COLOR_TONES = [
  '暖色调',
  '冷色调',
  '高饱和',
  '低饱和',
  '黑白',
] as const;

export const GENRE_VISUAL_LABELS: Record<Genre, string> = {
  xianxia: '仙侠玄幻',
  urban: '都市女频',
  fantasy: '西方奇幻',
  historical: '古风权谋',
  mystery: '悬疑推理',
  rebirth: '重生逆袭',
};

const SHOTS_JSON_BLOCK_INSTRUCTIONS = `## 结构化 JSON 输出要求
在完成上方的人类可读分镜提示词后，必须追加一个且仅一个 \`[SHOTS_JSON]\` 区块，格式如下：

[SHOTS_JSON]
\`\`\`json
[
  {
    "sceneId": "S01",
    "shotId": "S01-SH01",
    "shotType": "中景",
    "camera": "缓慢推进",
    "composition": "双人对角构图",
    "motion": "角色起身并转向门口",
    "subject": "林晚和顾承",
    "environment": "夜晚公寓客厅",
    "lighting": "暖色台灯与窗外冷色补光",
    "audioHint": "门锁轻响，背景环境音压低",
    "videoPrompt": "夜晚公寓客厅，中景，缓慢推进，双人对角构图，林晚和顾承同时入画，角色起身并转向门口，暖色台灯与窗外冷色补光，门锁轻响，背景环境音压低"
  }
]
\`\`\`

JSON 规则：
1. 必须是合法 JSON，使用双引号，不要注释，不要尾逗号
2. 数组中的每个对象都必须包含以上 11 个字段，且值必须是非空字符串
3. \`sceneId\` 与 \`shotId\` 必须稳定且可排序，例如 \`S01\`、\`S01-SH01\`
4. JSON 内容必须与上方文本分镜逐镜对应，不要新增文本中不存在的镜头
5. \`[SHOTS_JSON]\` 区块必须是输出的最后一段，JSON 代码块后不要再追加说明、标题或致歉`;

const SEEDANCE_STORYBOARD_GUIDANCE = `## Seedance 2.0 官方案例式分解要求
目标是让每个 \`videoPrompt\` 都能直接作为 Seedance 文生视频提示词继续测试。请按官方案例的写法补足：
1. 明确 T2V 语气：15s短剧分镜，可在单条提示词内描述连续动作和多镜头调度
2. 从开场镜位开始写：先说明场景、景别、构图和运镜，例如低机位跟拍、缓慢推进、快速平移、环绕或焦点转移
3. 动作要有连续性：写出角色先做什么、随后怎么变化、最后如何收束，避免只写静态画面
4. 加入物理和材质细节：服装、道具、光影反射、空间层次、动作惯性、环境颗粒或天气影响
5. 写清音频同步：对白、环境声、脚步声、音乐节拍、口型或音效要与动作对应
6. 保持主体一致性：人物外貌、服装、道具和场景关系不得在镜头中漂移
7. 如后续绑定参考图，可把人物/场景/道具改写为 @图片 N，但当前输出不要凭空生成不存在的参考图编号`;

function getTargetPlatformGuidance(targetPlatform?: StoryboardTargetPlatform): string {
  return targetPlatform === 'seedance' ? `\n${SEEDANCE_STORYBOARD_GUIDANCE}\n` : '';
}

/** 核心分镜生成 System Prompt */
export function getStoryboardSystemPrompt(): string {
  return `你是一位专业的短剧视频分镜师，擅长将剧本文字转化为详细的视频制作分镜提示词。

## 你的核心任务
将输入的剧本片段自动拆分为多个分镜（每个场景通常拆分为2-5个分镜），并为每个分镜生成详细的视频制作提示词。

## 分镜拆分原则
1. 每个独立的动作/对白/表情变化 = 一个分镜
2. 每个分镜时长通常 3-8 秒
3. 同一场景内，分镜之间要有镜头变化（景别/角度/运镜的变化）
4. 保证叙事连贯性，镜头切换要有逻辑

## 镜头类型参考
- 远景/全景：交代环境，展示整个场景
- 中景：半身拍摄，展示人物动作
- 近景：胸部以上，突出表情和情感
- 特写：面部/手部/物品细节
- 过肩镜头：从一个角色的肩膀后方拍摄另一个角色

## 严格输出格式
必须按照以下格式输出每个分镜，不要遗漏任何字段：

---

画面风格和类型: {{visualStyle}}, 电视风格, {{colorTone}}, {{genreLabel}}
生成一个由以下{{shotCount}}个分镜组成的视频:
场景: {{sceneDescription}}
分镜过渡: {{transitionDescription}}

分镜① {{duration}}s：时间：{{timeOfDay}}，场景图片：🖼️{{sceneName}}_0，镜头：{{cameraType}}，{{cameraAngleDescription}}，🧑 {{characterName}}-基础形象-基础形象 {{actionDescription}}，🧑 {{characterName}}-基础形象-基础形象 说：「{{dialogue}}」音色：{{voiceGender}}，{{voiceAge}}音色，音调{{pitch}}，{{voiceQuality}}，{{pronunciationStyle}}，{{backgroundDescription}}。{{cameraMovement}}。

---

## 关键格式规则
1. 角色标识始终用 "🧑 角色名-基础形象-基础形象" 格式
2. 场景标识始终用 "🖼️场景名_0" 格式
3. 台词用「」包裹，前面用"说："引出
4. 音色描述要具体：声音性别、年龄感、音调高低、音色质感、发音特征
5. 每个分镜必须指定运镜方式（镜头静止/缓慢推进/平移/拉远等）
6. 无台词的分镜可以省略"说"和"音色"部分
7. 多角色同场时，每个角色的动作都要分别描述

## 音色描述模板
- 男声示例：男声，青年音色，音调中等，音色明亮圆润，声音厚度适中，发音标准，气息沉稳，字正腔圆，富有感染力
- 女声示例：女声，青年音色，音调中等偏高，音色质感明亮、清脆，声音清亮柔和，发音方式干净，气息充沛平稳
- 情绪化示例：音色质感干净但偏扁平，语速偏快且气息不稳，紧张时带有轻微颤抖

${SHOTS_JSON_BLOCK_INSTRUCTIONS}`;
}

/** 生成分镜提示词的 User Prompt */
export function getStoryboardUserPrompt(
  scriptText: string,
  visualStyle: string,
  colorTone: string,
  genreLabel: string,
  targetPlatform?: StoryboardTargetPlatform
): string {
  return `请将以下剧本片段转化为详细的视频分镜提示词。

## 画面配置
- 画面风格: ${visualStyle}
- 色调: ${colorTone}
- 类型: ${genreLabel}
${getTargetPlatformGuidance(targetPlatform)}

## 剧本内容
${scriptText}

## 要求
1. 仔细阅读剧本，识别所有角色、场景、台词和动作指示
2. 将剧本拆分为合理的分镜片段（每个场景2-5个分镜）
3. 为每个分镜生成完整的提示词，严格按照系统指令中的格式输出
4. 确保角色的动作描述和情感表达与原剧本一致
5. 根据剧本中的情绪、场景氛围，选择合适的镜头类型和运镜方式
6. 每个有台词的分镜都必须包含详细的音色描述
7. 最终输出必须先给出人类可读分镜文本，再追加一个 \`[SHOTS_JSON]\` 区块，且 JSON 与文本逐镜对应
8. \`[SHOTS_JSON]\` 后只允许保留 JSON 代码块，不要在末尾补充任何解释

请直接输出分镜提示词，不要添加额外说明。`;
}

/** 安全模式下的分镜提示词 Prompt */
export function getStoryboardSafeUserPrompt(
  scriptText: string,
  visualStyle: string,
  colorTone: string,
  genreLabel: string,
  targetPlatform?: StoryboardTargetPlatform
): string {
  return `请将以下剧本片段转化为详细的视频分镜提示词，并使用平台安全、克制的影视化表达。

## 画面配置
- 画面风格: ${visualStyle}
- 色调: ${colorTone}
- 类型: ${genreLabel}
${getTargetPlatformGuidance(targetPlatform)}

## 安全输出要求
1. 只保留剧情推进所需的信息，不复现露骨的性描写、血腥细节、自残细节或违法细节
2. 若原文包含敏感内容，请统一改写为中性的影视镜头语言，例如"激烈冲突"、"亲密互动"、"危险场面"
3. 允许保留人物情绪、关系变化、场景调度和镜头运动
4. 禁止直接使用或扩写以下高风险表达：战场、兵器、追杀、屠杀、审问、黑市、拷打、尸体、鲜血、爆炸、崩塌、违禁交易、强制行为
5. 如原文包含门派斗争、追查、封印失控、地下交易、权势压迫等内容，请改写为"阵营对峙"、"线索调查"、"局势失衡"、"灰色交易传闻"、"紧张施压"等更克制的镜头语言
6. 优先呈现人物表情、场面气氛、关系张力、空间调度与镜头运动，不强调伤害方式、违法过程或危险后果的具体细节
7. 不要输出任何额外解释，仍然严格按分镜格式输出

## 剧本内容
${scriptText}

## 要求
1. 仔细阅读剧本，识别所有角色、场景、台词和动作指示
2. 将剧本拆分为合理的分镜片段（每个场景2-5个分镜）
3. 为每个分镜生成完整的提示词，严格按照系统指令中的格式输出
4. 确保角色的动作描述和情感表达与原剧本一致，但对敏感细节使用中性改写
5. 根据剧本中的情绪、场景氛围，选择合适的镜头类型和运镜方式，并将高风险叙事统一转成悬念、调查、对峙、危机感等安全表达
6. 每个有台词的分镜都必须包含详细的音色描述
7. 最终输出必须先给出人类可读分镜文本，再追加一个 \`[SHOTS_JSON]\` 区块，且 JSON 与文本逐镜对应
8. \`[SHOTS_JSON]\` 后只允许保留 JSON 代码块，不要在末尾补充任何解释

请直接输出分镜提示词，不要添加额外说明。`;
}

import {
  type EpisodeDuration,
  type GenerateConfig,
  Genre,
  SCRIPT_STYLE_LABELS,
  type ScriptStyle,
} from '../types';

/**
 * 通用基础 Prompt — 所有题材共享的剧本生成基础指令
 */

export const BASE_SYSTEM_PROMPT = `你是一位专业的编剧，擅长将网络小说改编为竖屏短剧剧本。

## 你的核心能力
- 精准提炼小说的核心情节和冲突
- 将叙述性文字转化为动作描写和对白
- 掌握短剧的节奏把控：快节奏、高密度爽点、强悬念
- 熟悉竖屏短剧的视觉语言（特写、近景为主）

## 短剧剧本格式规范
每集时长 1-3 分钟，需要包含：
1. **场景标题**：格式为 "【第N场】INT./EXT. 地点 - 时间"
2. **场景描述**：简短环境描写和人物状态，用括号包裹
3. **角色对白**：角色名顶格，对白另起一行缩进，情绪/动作提示用括号
4. **动作描述**：用"【动作】"标记，描述关键动作或特效
5. **转场**：用"【转场】"标记，如切/淡入/闪回

## 写作原则
- 每句对白不超过 20 字（适配字幕）
- 删除所有内心独白，转化为面部表情或动作
- 每场戏必须有明确目的：推进剧情 OR 制造冲突 OR 揭示信息
- 每集结尾必须有悬念钩子（hook）
- 竖屏短剧以特写和近景为主，避免大场景描写`;

/** 分析 Prompt */
export function getAnalysisPrompt(genre: Genre): string {
  const genreHints: Record<Genre, string> = {
    xianxia: '这是一部修仙题材小说。请特别关注：修炼境界体系、法宝法术、门派关系、升级打怪的爽点节奏。',
    urban: '这是一部都市情感题材小说。请特别关注：人物情感关系、误解与反转、身份秘密、情感冲突的爆发点。',
    fantasy: '这是一部奇幻题材小说。请特别关注：世界观设定、魔法/能力体系、种族阵营、冒险任务线索。',
  };

  return `${BASE_SYSTEM_PROMPT}

## 当前任务：小说分析
${genreHints[genre]}

请分析以下小说文本，输出 JSON 格式的分析结果：

\`\`\`json
{
  "title": "推测的故事标题",
  "characters": [
    {
      "name": "角色名",
      "description": "一句话描述",
      "personality": "性格特点",
      "speechStyle": "说话风格/口头禅",
      "relationships": ["与其他角色的关系"]
    }
  ],
  "plotSummary": "100字以内的核心剧情概述",
  "keyConflicts": ["主要冲突点1", "主要冲突点2"],
  "climaxPoints": ["高潮/爽点1", "高潮/爽点2"],
  "emotionalBeats": ["情感节奏点1", "情感节奏点2"]
}
\`\`\`

只输出 JSON，不要输出其他内容。`;
}

/** 大纲生成 Prompt */
export function getOutlinePrompt(genre: Genre, episodeCount: number): string {
  const genreStructure: Record<Genre, string> = {
    xianxia: `修仙短剧典型结构：
- 开局：主角受辱/陷入绝境
- 机缘：获得逆天功法/神器/师父
- 装弱：隐藏实力，被人看不起
- 爆发：关键时刻碾压对手，一鸣惊人
- 震惊：旁观者"这不可能！"的反应
每集必须有至少一个"打脸"或"升级"的爽点。`,
    urban: `都市情感短剧典型结构：
- 开局：重逢/误解/身份反转
- 纠缠：感情线推进，制造误会和障碍
- 揭秘：关键信息揭示，反转观众认知
- 抉择：主角面临核心选择
- 高潮：感情爆发/真相大白
每集必须有至少一个情感冲突或反转。`,
    fantasy: `奇幻短剧典型结构：
- 开局：平凡世界被打破，踏入奇幻世界
- 成长：获得能力，面对挑战
- 伙伴：结识盟友，组建团队
- 危机：强敌出现，陷入绝境
- 逆袭：超越极限，终极对决
每集必须有至少一个战斗或冒险场景。`,
  };

  return `${BASE_SYSTEM_PROMPT}

## 当前任务：分集大纲规划
${genreStructure[genre]}

根据小说分析结果，规划 ${episodeCount} 集短剧大纲。

要求：
1. 每集 1-3 分钟（约 300-500 字剧本）
2. 每集有明确的开头钩子和结尾悬念
3. 集与集之间有强关联性，让观众想看下一集
4. 重要剧情节点的分布要均匀

请输出 JSON 数组：
\`\`\`json
[
  {
    "episodeNumber": 1,
    "title": "集标题（4-8字，有吸引力）",
    "summary": "本集剧情概要（50字以内）",
    "keyEvents": ["关键事件1", "关键事件2"],
    "hook": "本集结尾悬念（一句话）"
  }
]
\`\`\`

只输出 JSON，不要输出其他内容。`;
}

function getDurationGuidance(duration: EpisodeDuration): string {
  const guidance: Record<EpisodeDuration, string> = {
    '1:00-1:30': '目标时长偏短，建议控制在 2-3 场戏，开场即冲突，结尾即钩子，尽量 220-320 字内完成。',
    '1:30-2:00': '目标时长标准，建议控制在 3-4 场戏，保证转折和悬念完整，约 300-500 字剧本。',
    '2:00-3:00': '目标时长偏长，建议控制在 4-6 场戏，可加入一段铺垫或副冲突，但节奏不能松散，约 450-700 字剧本。',
  };

  return guidance[duration];
}

function getStyleGuidance(style: ScriptStyle): string {
  const guidance: Record<ScriptStyle, string> = {
    dramatic: `戏剧风格强化要求：
- 情绪起伏要明显，冲突升级要快
- 对白优先服务人物关系和压迫感
- 每场戏至少有一个明确的情绪爆点或关系反转`,
    comedic: `喜剧风格强化要求：
- 在不破坏主线的前提下提高轻松感和反差笑点
- 对白可加入机锋、误会、节奏性包袱，但不要低幼
- 场景调度优先制造反差和意外，结尾钩子也可以带幽默反转`,
    suspense: `悬疑风格强化要求：
- 信息披露必须分层，避免一次性说透
- 通过细节、停顿、异常反应制造不安感
- 每场戏都要留下新的疑问、误导或危险信号`,
  };

  return guidance[style];
}

/** 剧本生成 Prompt */
export function getScriptPrompt(
  genre: Genre,
  config: Pick<GenerateConfig, 'episodeDuration' | 'style'>
): string {
  const genreStyle: Record<Genre, string> = {
    xianxia: `修仙剧本风格要求：
- 对白风格：古风韵味但不过度文言，适度中二热血
- 动作描写：法术特效要有视觉冲击力（"金光大放"、"剑气纵横"）
- 境界描述：简洁有力的修为展示（"筑基期修为，竟然一拳轰飞了金丹期的长老？！"）
- 装逼名场面：要有"你以为这就是我的全部实力？"类似的经典台词
- 震惊反应：旁观者的震惊必须写得夸张有感染力`,
    urban: `都市情感剧本风格要求：
- 对白风格：现代都市口语，自然真实有张力
- 情感表达：通过眼神、小动作传递情感，而非直白表白
- 冲突设计：每场戏至少有一个小冲突或情绪波动
- 反转设计：身份/真相的揭露要分层次，保持悬念
- 配乐提示：在关键情感节点标注BGM风格建议`,
    fantasy: `奇幻剧本风格要求：
- 对白风格：根据种族/身份调整语气（精灵优雅、矮人粗犷等）
- 场景描写：奇幻世界的视觉奇观要写得有画面感
- 战斗场面：招式名称要响亮，战斗节奏要有起伏
- 世界观暗示：通过对话和场景自然展示世界观，不要强行解说
- 特效提示：魔法/能力的视觉呈现要具体可执行`,
  };

  return `${BASE_SYSTEM_PROMPT}

## 当前任务：生成完整剧本
${genreStyle[genre]}

## 本次生成配置
- 目标单集时长：${config.episodeDuration}
- 指定剧本风格：${SCRIPT_STYLE_LABELS[config.style]}
- ${getDurationGuidance(config.episodeDuration)}
${getStyleGuidance(config.style)}

根据提供的大纲和角色信息，生成完整的单集剧本。

### 输出格式（严格遵循）

═══════════════════════════════════════
  第 X 集 · 《集标题》
  预估时长: X:XX
═══════════════════════════════════════

【第 1 场】INT./EXT. 地点 - 时间

（场景描述：简短的环境和氛围描写）

角色名
  （情绪/动作提示）
  角色的对白内容

【动作】具体的动作或特效描写

【转场】切

... (更多场景)

──────────────────────────────────────
▸ 本集钩子: 一句话概括本集结尾悬念
▸ 下集预告: 简要预告下集走向
──────────────────────────────────────

请直接输出剧本文本，不要添加任何额外说明。`;
}

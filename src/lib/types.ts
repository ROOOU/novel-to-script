// ===== 核心类型定义 =====

/** 题材类型 */
export const GENRE_VALUES = ['xianxia', 'urban', 'fantasy', 'historical', 'mystery', 'rebirth'] as const;
export type Genre = (typeof GENRE_VALUES)[number];

/** 题材中文标签 */
export const GENRE_LABELS: Record<Genre, string> = {
  xianxia: '仙侠修真',
  urban: '都市情感',
  fantasy: '奇幻冒险',
  historical: '古风权谋',
  mystery: '悬疑推理',
  rebirth: '重生逆袭',
};

/** 题材英文标签 */
export const GENRE_LABELS_EN: Record<Genre, string> = {
  xianxia: 'Xianxia',
  urban: 'Urban romance',
  fantasy: 'Fantasy adventure',
  historical: 'Historical intrigue',
  mystery: 'Mystery thriller',
  rebirth: 'Rebirth revenge',
};

/** 单集时长配置 */
export type EpisodeDuration = '1:00-1:30' | '1:30-2:00' | '2:00-3:00';

/** 剧本风格配置 */
export const SCRIPT_STYLE_VALUES = ['dramatic', 'comedic', 'suspense', 'sweet', 'dark', 'highEnergy'] as const;
export type ScriptStyle = (typeof SCRIPT_STYLE_VALUES)[number];

/** 时长选项 */
export const EPISODE_DURATION_LABELS: Record<EpisodeDuration, string> = {
  '1:00-1:30': '1:00-1:30',
  '1:30-2:00': '1:30-2:00',
  '2:00-3:00': '2:00-3:00',
};

/** 剧本风格中文标签 */
export const SCRIPT_STYLE_LABELS: Record<ScriptStyle, string> = {
  dramatic: '戏剧化',
  comedic: '轻喜剧',
  suspense: '悬疑压迫',
  sweet: '甜宠',
  dark: '暗黑向',
  highEnergy: '爽感快节奏',
};

/** 剧本风格英文标签 */
export const SCRIPT_STYLE_LABELS_EN: Record<ScriptStyle, string> = {
  dramatic: 'Dramatic',
  comedic: 'Comedic',
  suspense: 'Suspenseful',
  sweet: 'Sweet romance',
  dark: 'Dark tone',
  highEnergy: 'High energy',
};

/** 角色信息 */
export interface Character {
  name: string;
  description: string;
  personality: string;
  speechStyle: string;
  relationships: string[];
}

/** 章节 */
export interface Chapter {
  index: number;
  title: string;
  content: string;
  wordCount: number;
}

/** 小说分析结果 */
export interface NovelAnalysis {
  title: string;
  genre: Genre;
  characters: Character[];
  plotSummary: string;
  keyConflicts: string[];
  climaxPoints: string[];
  emotionalBeats: string[];
}

/** 场景 */
export interface Scene {
  sceneNumber: number;
  heading: string;        // 场景标题: INT./EXT. 地点 - 时间
  description: string;    // 场景描述
  dialogues: Dialogue[];  // 对白列表
  actions: string[];      // 动作/特效描述
  transition: string;     // 转场提示
}

/** 对白 */
export interface Dialogue {
  character: string;
  parenthetical?: string;  // 情绪/动作提示
  line: string;            // 对白内容
}

/** 单集剧本 */
export interface Episode {
  episodeNumber: number;
  title: string;
  estimatedDuration: string;
  scenes: Scene[];
  hook: string;           // 本集悬念钩子
  nextPreview: string;    // 下集预告
}

/** 分集大纲条目 */
export interface OutlineEntry {
  episodeNumber: number;
  title: string;
  summary: string;
  keyEvents: string[];
  hook: string;
}

/** 生成配置 */
export interface GenerateConfig {
  genre: Genre;
  episodeCount: number;         // 目标集数
  episodeDuration: EpisodeDuration;      // 每集时长 (如 '1:30-2:00')
  style: ScriptStyle;  // 剧本风格
  includeDirectorNotes: boolean; // 是否包含导演提示
}

export type ExecutionMode = 'direct' | 'segmented';
export type PipelineMode = ExecutionMode;
export type GenerationMode = 'quick' | 'longform';
export type GenerationTargetOutput = 'script' | 'prompt_pack' | 'full_pipeline';

export interface ComplexityInfo {
  score: number;
  textLength: number;
  estimatedSceneBreaks: number;
  estimatedTimeJumps: number;
  estimatedPovSwitches: number;
  estimatedCharacterDensity: number;
  recommendedExecutionMode: ExecutionMode;
  chunkCount: number;
}

/** 生成状态 */
export type GenerateStatus = 'idle' | 'preprocessing' | 'analyzing' | 'outlining' | 'generating' | 'done' | 'error';

/** 生成进度 */
export interface GenerateProgress {
  status: GenerateStatus;
  currentStep: string;
  progress: number;       // 0-100
  result?: string;        // 当前生成的文本
  error?: string;
}

/** API 请求体 - 分析 */
export interface AnalyzeRequest {
  text: string;
  genre: Genre;
}

/** API 请求体 - 生成 */
export interface GenerateRequest {
  text: string;
  genre: Genre;
  config: GenerateConfig;
  analysis?: NovelAnalysis;
  mode?: GenerationMode;
  targetOutput?: GenerationTargetOutput;
  executionMode?: ExecutionMode;
  complexityInfo?: ComplexityInfo;
}

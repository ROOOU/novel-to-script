// ===== 核心类型定义 =====

/** 题材类型 */
export type Genre = 'xianxia' | 'urban' | 'fantasy';

/** 题材中文标签 */
export const GENRE_LABELS: Record<Genre, string> = {
  xianxia: '修仙',
  urban: '都市情感',
  fantasy: '奇幻',
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
  episodeDuration: string;      // 每集时长 (如 '1:30-2:00')
  style: 'dramatic' | 'comedic' | 'suspense';  // 剧本风格
  includeDirectorNotes: boolean; // 是否包含导演提示
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
}

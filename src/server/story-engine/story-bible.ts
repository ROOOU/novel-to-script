import { GENRE_LABELS, SCRIPT_STYLE_LABELS, type NovelAnalysis, type OutlineEntry, type ScriptStyle } from '@/lib/types';
import type { SceneCard, StoryBible, StoryBibleLocationState, StoryBiblePropState, StoryBibleTimelineEvent } from '@/server/shared/platform/domain';

const LOCATION_STOP_WORDS = new Set([
  '这里',
  '那里',
  '这边',
  '那边',
  '这时',
  '此时',
  '这期间',
  '期间',
  '局势',
  '队伍',
  '法士',
  '修士',
]);
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
const LOCATION_CONTEXT_PATTERNS = [
  /(?:在|于|回到|来到|进入|进了|出了|直奔|赶到|赶往|通过)(?:了)?([^，。；\s]{2,12})/gu,
  /(?:^|[，。；！？\n])([\u4e00-\u9fff]{2,8}(?:车内|草原|荒原|小山|灵山|洞府|殿内|宫内|山谷|山脉|国|城|山|谷|宫|殿|原|盟))/gu,
];

export function buildStoryBible(input: {
  analysis: NovelAnalysis;
  outline?: OutlineEntry[];
  style: ScriptStyle;
}): StoryBible {
  const timeline = (input.outline ?? []).map<StoryBibleTimelineEvent>((entry) => ({
    id: `episode-${entry.episodeNumber}`,
    title: entry.title,
    summary: entry.summary,
  }));

  return {
    projectSummary: input.analysis.plotSummary,
    genre: GENRE_LABELS[input.analysis.genre] ?? input.analysis.genre,
    themes: uniqueNonEmpty([
      ...input.analysis.keyConflicts,
      ...input.analysis.emotionalBeats,
    ]).slice(0, 8),
    toneGuide: uniqueNonEmpty([
      SCRIPT_STYLE_LABELS[input.style] ?? input.style,
      '面向短剧节奏',
      '场景表达清晰',
      '对白可分镜化',
    ]),
    characters: input.analysis.characters.map((character) => ({
      name: character.name,
      description: character.description,
      personality: character.personality,
      speechStyle: character.speechStyle,
      relationships: uniqueNonEmpty(character.relationships),
    })),
    locations: inferLocations(input.analysis.plotSummary, input.outline),
    props: inferProps(input.analysis.keyConflicts),
    timeline,
    worldRules: uniqueNonEmpty([
      input.analysis.genre === 'xianxia' ? '保留修仙/仙侠世界规则的一致性。' : '',
      input.analysis.genre === 'fantasy' ? '保留奇幻设定、能力边界与世界逻辑。' : '',
      input.analysis.genre === 'historical' ? '保留礼制、阶级与权力结构的一致性。' : '',
      input.analysis.genre === 'mystery' ? '所有线索与真相必须前后呼应，避免无因反转。' : '',
      input.analysis.genre === 'rebirth' ? '前世记忆带来的信息差和命运改写逻辑必须自洽。' : '',
    ]),
    unresolvedThreads: uniqueNonEmpty([
      ...input.analysis.climaxPoints,
      ...input.analysis.keyConflicts,
    ]),
  };
}

export function buildSceneCards(input: {
  analysis: NovelAnalysis;
  outline: OutlineEntry[];
}): SceneCard[] {
  return input.outline.map((entry, index, entries) => ({
    sceneId: `scene-${String(entry.episodeNumber).padStart(2, '0')}`,
    title: entry.title,
    summary: entry.summary,
    characters: matchCharacters(entry.summary, input.analysis.characters.map((character) => character.name)),
    location: '待补充场景地点',
    time: '待补充时间信息',
    goal: entry.keyEvents[0] ?? entry.summary,
    conflict: entry.keyEvents[1] ?? input.analysis.keyConflicts[0] ?? '待补充冲突',
    turningPoint: entry.hook || entry.keyEvents.at(-1) || entry.summary,
    visualBeats: uniqueNonEmpty(entry.keyEvents),
    continuityIn: index > 0 ? [entries[index - 1].hook || entries[index - 1].summary] : undefined,
    continuityOut: index < entries.length - 1 ? [entry.hook || entries[index + 1].summary] : undefined,
  }));
}

function inferLocations(plotSummary: string, outline?: OutlineEntry[]): StoryBibleLocationState[] {
  const source = [plotSummary, ...(outline?.map((entry) => entry.summary) ?? [])].join(' ');
  const matches = LOCATION_CONTEXT_PATTERNS.flatMap((pattern) =>
    Array.from(source.matchAll(pattern)).map((match) => normalizeLocationCandidate(match[1] ?? ''))
  ).filter((value) => isLikelyLocationToken(value));

  return uniqueNonEmpty(matches).slice(0, 6).map((name) => ({
    name,
    description: `${name} 相关场景待继续细化`,
  }));
}

function inferProps(keyConflicts: string[]): StoryBiblePropState[] {
  return uniqueNonEmpty(keyConflicts)
    .slice(0, 4)
    .map((conflict, index) => ({
      name: `关键线索${index + 1}`,
      significance: conflict,
    }));
}

function matchCharacters(summary: string, characterNames: string[]) {
  const matches = characterNames.filter((name) => name && summary.includes(name));
  return matches.length > 0 ? matches : characterNames.slice(0, 3);
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
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

function isLikelyLocationToken(value: string) {
  return (
    value.length >= 2 &&
    value.length <= 8 &&
    !LOCATION_STOP_WORDS.has(value) &&
    !/[看说想觉判断观察对视]/.test(value) &&
    !/[的一了着过]/.test(value)
  );
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

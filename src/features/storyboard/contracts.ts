import type { PromptPackTargetPlatform, StoryBible, SceneCard } from '@/server/shared/platform/domain';

export interface StoryboardGenerateRequest {
  scriptText?: string;
  visualStyle?: string;
  colorTone?: string;
  genreLabel?: string;
  safeMode?: boolean;
  storyBible?: StoryBible;
  sceneCards?: SceneCard[];
  outputMode?: 'prompt_only' | 'structured_shots' | 'full';
  targetPlatform?: PromptPackTargetPlatform;
  characterRefs?: Array<{ id: string; label: string }>;
  locationRefs?: Array<{ id: string; label: string }>;
  continuityHints?: string[];
}

export type StoryboardGenerationScope = 'all' | 'selection';

export interface StoryboardGenerationSelection {
  artifactIds?: string[];
  episodeNumbers?: number[];
  sceneIds?: string[];
}

export interface StoryboardGenerateRequestV2 extends StoryboardGenerateRequest {
  scope?: StoryboardGenerationScope;
  selection?: StoryboardGenerationSelection;
  scriptArtifactIds?: string[];
}

export interface StoryboardGenerationEvent {
  [key: string]: unknown;
  step:
    | 'parsing'
    | 'parsed'
    | 'generating'
    | 'safety_retry'
    | 'content_policy_blocked'
    | 'streaming'
    | 'done'
    | 'error';
  message?: string;
  characters?: string[];
  scenes?: string[];
  retryPrompt?: string;
  chunk?: string;
  content?: string;
}

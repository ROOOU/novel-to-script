export interface StoryboardGenerateRequest {
  scriptText?: string;
  visualStyle?: string;
  colorTone?: string;
  genreLabel?: string;
  safeMode?: boolean;
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

export interface StoryboardGenerateRequest {
  scriptText: string;
  visualStyle?: string;
  colorTone?: string;
  genreLabel?: string;
  safeMode?: boolean;
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

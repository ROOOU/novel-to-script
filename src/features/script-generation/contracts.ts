import type { GenerateRequest } from '@/lib/types';

export type ScriptGenerationRequest = GenerateRequest;

export interface ScriptGenerationEvent {
  [key: string]: unknown;
  step:
    | 'preprocessing'
    | 'analyzing'
    | 'analyzed'
    | 'outlining'
    | 'outlined'
    | 'generating'
    | 'streaming'
    | 'episode_done'
    | 'done'
    | 'error';
  message?: string;
  data?: string;
  parseError?: string | null;
  episode?: number;
  chunk?: string;
  content?: string;
}

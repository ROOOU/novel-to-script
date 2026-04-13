import type { LLMConfig } from '@/lib/llm';
import type {
  StoryboardGenerateRequestV2,
  StoryboardGenerationEvent,
} from '@/features/storyboard/contracts';
import type { PlatformRequestContext, PlatformUsageEvent, UsageMeter } from '@/server/shared/platform';
import type { SSESender } from '@/server/shared/sse';

export interface StoryboardGenerationExecutionOptions {
  body: StoryboardGenerateRequestV2;
  context: PlatformRequestContext;
  jobId?: string | null;
  send: SSESender<StoryboardGenerationEvent>;
  llmConfig: LLMConfig;
  usageMeter?: Pick<UsageMeter, 'record'>;
  onProgress?: (progress: StoryboardGenerationProgressUpdate) => Promise<void> | void;
  onArtifact?: (artifact: StoryboardGenerationArtifactRecord) => Promise<void> | void;
}

export interface StoryboardGenerationProgressUpdate {
  progress: number;
  currentStep: string;
  outputSummary?: string;
}

export interface StoryboardGenerationArtifactRecord {
  kind: 'storyboard' | 'shot_plan' | 'prompt_pack';
  title: string;
  format: 'text/plain' | 'application/json';
  content: string;
  metadata?: Record<string, unknown>;
}

export function buildStoryboardUsageEvent(
  context: PlatformRequestContext,
  amount: number,
  unit: PlatformUsageEvent['unit'],
  metadata?: Record<string, unknown>
): PlatformUsageEvent {
  return {
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    userId: context.userId,
    requestId: context.requestId,
    feature: 'storyboard-generation',
    unit,
    amount,
    plan: context.plan,
    metadata: {
      ...metadata,
      occurredAt: new Date().toISOString(),
    },
  };
}

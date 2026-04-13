import type { LLMConfig } from '@/lib/llm';
import type { ScriptGenerationEvent, ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { PlatformRequestContext, PlatformUsageEvent, UsageMeter } from '@/server/shared/platform';
import type { SSESender } from '@/server/shared/sse';

export interface ScriptGenerationExecutionOptions {
  body: ScriptGenerationRequest;
  context: PlatformRequestContext;
  jobId?: string | null;
  send: SSESender<ScriptGenerationEvent>;
  llmConfig: LLMConfig;
  usageMeter?: Pick<UsageMeter, 'record'>;
  onProgress?: (progress: ScriptGenerationProgressUpdate) => Promise<void> | void;
  onArtifact?: (artifact: ScriptGenerationArtifactRecord) => Promise<void> | void;
}

export interface ScriptGenerationProgressUpdate {
  progress: number;
  currentStep: string;
  outputSummary?: string;
}

export interface ScriptGenerationArtifactRecord {
  kind: 'analysis' | 'story_bible' | 'scene_cards' | 'outline' | 'script';
  title: string;
  format: 'application/json' | 'text/plain';
  content: string;
  metadata?: Record<string, unknown>;
}

export function buildScriptUsageEvent(
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
    feature: 'script-generation',
    unit,
    amount,
    plan: context.plan,
    metadata: {
      ...metadata,
      occurredAt: new Date().toISOString(),
    },
  };
}

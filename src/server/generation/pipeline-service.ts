import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequestV2 } from '@/features/storyboard/contracts';
import type { ComplexityInfo, ExecutionMode, GenerationMode, GenerationTargetOutput } from '@/lib/types';
import { buildStoryChunks } from '@/server/story-engine/chunking';
import { evaluateStoryComplexity } from '@/server/story-engine/complexity';
import { createProjectGenerationJob } from './service';

export interface NovelToStoryboardPipelineRequest {
  text: string;
  genre: ScriptGenerationRequest['genre'];
  config: ScriptGenerationRequest['config'];
  analysis?: ScriptGenerationRequest['analysis'];
  mode?: GenerationMode;
  targetOutput?: GenerationTargetOutput;
  executionMode?: ExecutionMode;
  complexityInfo?: ComplexityInfo;
  storyboardConfig?: Omit<StoryboardGenerateRequestV2, 'scriptArtifactIds' | 'scriptText'>;
}

export async function createNovelToStoryboardPipeline(input: {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  body: NovelToStoryboardPipelineRequest;
}) {
  const complexityInfo = input.body.complexityInfo ?? evaluateStoryComplexity(input.body.text);
  const executionMode = input.body.executionMode ?? complexityInfo.recommendedExecutionMode;
  const storyChunks = buildStoryChunks(input.body.text, complexityInfo);
  const generationMode = input.body.mode ?? (executionMode === 'segmented' ? 'longform' : 'quick');
  const scriptJob = await createProjectGenerationJob({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    userId: input.userId,
    kind: 'script-generation',
    body: {
      text: input.body.text,
      genre: input.body.genre,
      config: input.body.config,
      analysis: input.body.analysis,
      mode: generationMode,
      targetOutput: input.body.targetOutput ?? 'full_pipeline',
      executionMode,
      complexityInfo,
    },
    metadata: {
      pipelineMode: 'novel-to-storyboard',
      generationMode,
      executionMode,
      complexityInfo,
      chunkPlan: {
        strategy: executionMode === 'segmented' ? 'segmented' : 'single',
        chunkCount: storyChunks.length,
        chunks: storyChunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          index: chunk.index,
          charCount: chunk.charCount,
        })),
      },
      storyboardPayload: input.body.storyboardConfig ?? {},
    },
  });

  return {
    mode: 'novel-to-storyboard' as const,
    job: scriptJob,
  };
}

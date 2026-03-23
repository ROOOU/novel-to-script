import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequestV2 } from '@/features/storyboard/contracts';
import { createProjectGenerationJob } from './service';

export interface NovelToStoryboardPipelineRequest {
  text: string;
  genre: ScriptGenerationRequest['genre'];
  config: ScriptGenerationRequest['config'];
  analysis?: ScriptGenerationRequest['analysis'];
  storyboardConfig?: Omit<StoryboardGenerateRequestV2, 'scriptArtifactIds' | 'scriptText'>;
}

export async function createNovelToStoryboardPipeline(input: {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  body: NovelToStoryboardPipelineRequest;
}) {
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
    },
    metadata: {
      pipelineMode: 'novel-to-storyboard',
      storyboardPayload: input.body.storyboardConfig ?? {},
    },
  });

  return {
    mode: 'novel-to-storyboard' as const,
    job: scriptJob,
  };
}

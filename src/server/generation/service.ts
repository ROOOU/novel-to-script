import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequestV2 } from '@/features/storyboard/contracts';
import type { VideoGenerationRequest } from '@/features/video-generation/contracts';
import { getProjectGenerationScheduler } from './queue';
import { createPersistedGenerationJob } from './processor';

export type { ProjectGenerationKind } from './processor';
export { processPersistedGenerationJob } from './processor';

export async function createProjectGenerationJob(input: {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  kind: 'script-generation' | 'storyboard-generation' | 'video-generation';
  body: ScriptGenerationRequest | StoryboardGenerateRequestV2 | VideoGenerationRequest;
  metadata?: Record<string, unknown>;
}) {
  const job = await createPersistedGenerationJob(input);
  await getProjectGenerationScheduler().schedule(job.id);

  return job;
}

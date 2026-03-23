import type { ScriptGenerationRequest } from '@/features/script-generation/contracts';
import type { StoryboardGenerateRequest } from '@/features/storyboard/contracts';
import { getProjectGenerationScheduler } from './queue';
import { createPersistedGenerationJob } from './processor';

export type { ProjectGenerationKind } from './processor';
export { processPersistedGenerationJob } from './processor';

export async function createProjectGenerationJob(input: {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  kind: 'script-generation' | 'storyboard-generation';
  body: ScriptGenerationRequest | StoryboardGenerateRequest;
}) {
  const job = await createPersistedGenerationJob(input);
  await getProjectGenerationScheduler().schedule(job.id);

  return job;
}

import type { PlatformRequestContext } from './context';
import type { GenerationJob } from './domain';

export const GENERATION_ACCESS_TOKEN_HEADER = 'x-generation-access-token';

export function canAccessJob(
  job: GenerationJob,
  context: PlatformRequestContext
): boolean {
  if (context.userId && job.requestedByUserId && context.userId === job.requestedByUserId) {
    return true;
  }

  if (
    context.sessionId &&
    job.requestedBySessionId &&
    context.sessionId === job.requestedBySessionId
  ) {
    return true;
  }

  return false;
}

export function resolveGenerationAccessToken(request: Request): string | null {
  return request.headers.get(GENERATION_ACCESS_TOKEN_HEADER)?.trim() || null;
}

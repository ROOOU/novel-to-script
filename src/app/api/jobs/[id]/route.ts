import { NextRequest } from 'next/server';
import {
  applyPlatformResponseHeaders,
  GENERATION_ACCESS_TOKEN_HEADER,
  getPlatformRuntime,
  getPlanHeaderDefault,
  resolvePlatformRequestContext,
  resolveGenerationAccessToken,
} from '@/server/shared/platform';
import { getCurrentViewer } from '@/server/auth/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const runtime = getPlatformRuntime();
  const context = resolvePlatformRequestContext(request, {
    defaultPlan: getPlanHeaderDefault(request),
  });
  const job = await runtime.generationJobs.getById(id);

  if (!job) {
    return applyPlatformResponseHeaders(new Response(
      JSON.stringify({ error: 'Job not found' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    ), context);
  }

  const accessToken = resolveGenerationAccessToken(request);
  const viewer = await getCurrentViewer();
  const canReadWithSession = viewer?.organization.id === job.organizationId;
  if (!canReadWithSession && !runtime.generationJobAccess.verify(job.id, accessToken)) {
    return applyPlatformResponseHeaders(new Response(
      JSON.stringify({ error: 'Forbidden: missing or invalid generation access token' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Required-Auth': GENERATION_ACCESS_TOKEN_HEADER,
        },
      }
    ), context);
  }

  const response = new Response(JSON.stringify(job), {
    headers: { 'Content-Type': 'application/json' },
  });
  response.headers.set('X-Generation-Job-Id', job.id);

  return applyPlatformResponseHeaders(response, context);
}

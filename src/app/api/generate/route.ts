import { NextRequest } from 'next/server';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import {
  type ScriptGenerationEvent,
  type ScriptGenerationRequest,
} from '@/features/script-generation/contracts';
import { runScriptGeneration } from '@/server/script-generation/application/run-script-generation';
import {
  applyPlatformResponseHeaders,
  createPlatformJsonErrorResponse,
  evaluatePlatformFeatureAccess,
  evaluateUsagePreflight,
  getPlatformRuntime,
  getPlanHeaderDefault,
  getUsageBudgetFromEntitlements,
  resolvePlatformRequestContext,
  resolveRuntimeOrganizationId,
  resolveRuntimeProjectId,
  resolveRuntimeWorkspaceId,
  resolvePlatformLLMConfig,
} from '@/server/shared/platform';
import { createSSEStreamResponse } from '@/server/shared/sse';
import { scriptGenerationPayloadSchema } from '@/app/api/projects/[projectId]/jobs/schema';

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, { scope: 'generate' });
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  const platformContext = resolvePlatformRequestContext(request, {
    defaultPlan: getPlanHeaderDefault(request),
  });

  try {
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return createPlatformJsonErrorResponse(platformContext, '请求体不是合法 JSON', 400);
    }

    const validation = scriptGenerationPayloadSchema.safeParse(requestBody);
    if (!validation.success) {
      return createPlatformJsonErrorResponse(platformContext, '缺少必要参数', 400);
    }

    const body = validation.data as ScriptGenerationRequest;
    const runtime = getPlatformRuntime();
    const runtimeWorkspaceId = resolveRuntimeWorkspaceId(platformContext.workspaceId);
    const usageSnapshot = await runtime.usageMeter.snapshot(runtimeWorkspaceId);
    const activeJobs = await runtime.generationJobs.listActiveByWorkspaceId(runtimeWorkspaceId);

    const platformAccess = evaluatePlatformFeatureAccess(platformContext, {
      feature: 'script-generation',
      episodeCount: body.config.episodeCount,
    });
    if (!platformAccess.allowed) {
      return createPlatformJsonErrorResponse(
        platformContext,
        platformAccess.reason ?? '当前请求不满足套餐限制',
        platformAccess.status ?? 403
      );
    }

    const usagePreflight = evaluateUsagePreflight(
      getUsageBudgetFromEntitlements(platformAccess.entitlements),
      {
        snapshot: usageSnapshot,
        pendingRequestCount: 1,
        pendingCharacterCount: body.text.length,
        activeJobCount: activeJobs.length,
      }
    );
    if (!usagePreflight.allowed) {
      return createPlatformJsonErrorResponse(
        platformContext,
        usagePreflight.reason ?? '当前请求已超出使用额度',
        403
      );
    }

    const llmResolution = resolvePlatformLLMConfig(platformContext);
    if (llmResolution.error || !llmResolution.config) {
      return createPlatformJsonErrorResponse(
        platformContext,
        llmResolution.error ?? 'LLM 配置解析失败',
        500
      );
    }
    const llmConfig = llmResolution.config;

    const job = await runtime.generationJobs.create({
      organizationId: resolveRuntimeOrganizationId(platformContext.organizationId),
      workspaceId: runtimeWorkspaceId,
      projectId: resolveRuntimeProjectId(platformContext.projectId, 'script-generation'),
      kind: 'script-generation',
      requestedByUserId: platformContext.userId,
      requestedBySessionId: platformContext.sessionId,
      modelName: llmConfig.modelName ?? null,
      inputSnapshot: {
        requestId: platformContext.requestId,
        sessionId: platformContext.sessionId,
        genre: body.genre,
        episodeCount: body.config.episodeCount,
        episodeDuration: body.config.episodeDuration,
        style: body.config.style,
      },
    });
    await runtime.generationJobs.markRunning(job.id, undefined, platformContext.userId);
    const accessToken = runtime.generationJobAccess.issue(job.id);

    const response = createSSEStreamResponse<ScriptGenerationEvent>(
      async (send) => {
        try {
          await runScriptGeneration({
            body,
            context: platformContext,
            jobId: job.id,
            send,
            llmConfig,
            usageMeter: runtime.usageMeter,
            onProgress: async (progress) => {
              await runtime.generationJobs.update(job.id, {
                progress: progress.progress,
                currentStep: progress.currentStep,
                outputSummary: progress.outputSummary,
                updatedByUserId: platformContext.userId,
              });
            },
            onArtifact: async (artifact) => {
              await runtime.generationArtifacts.create({
                organizationId: job.organizationId,
                workspaceId: job.workspaceId,
                projectId: job.projectId,
                generationJobId: job.id,
                kind: artifact.kind,
                format: artifact.format,
                title: artifact.title,
                content: artifact.content,
                metadata: artifact.metadata,
                createdByUserId: platformContext.userId,
              });
            },
          });
          await runtime.generationJobs.markSucceeded(job.id, {
            progress: 100,
            currentStep: 'done',
            outputSummary: `Generated ${body.config.episodeCount} episodes`,
            updatedByUserId: platformContext.userId,
          });
        } catch (error) {
          await runtime.generationJobs.markFailed(job.id, {
            errorMessage: error instanceof Error ? error.message : '生成失败',
            updatedByUserId: platformContext.userId,
          });
          throw error;
        }
      },
      {
        onError: (error) => ({
          step: 'error',
          message: error instanceof Error ? error.message : '生成过程出错，请检查后端 LLM 配置',
        }),
      }
    );
    response.headers.set('X-Generation-Job-Id', job.id);
    response.headers.set('X-Generation-Access-Token', accessToken);

    return applyPlatformResponseHeaders(response, platformContext);
  } catch (error) {
    console.error('Generate error:', platformContext.requestId, error);
    return createPlatformJsonErrorResponse(
      platformContext,
      error instanceof Error ? error.message : '生成失败',
      500
    );
  }
}

import { NextRequest } from 'next/server';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import {
  type StoryboardGenerateRequest,
  type StoryboardGenerationEvent,
} from '@/features/storyboard/contracts';
import {
  getStoryboardRequestError,
  runStoryboardGeneration,
} from '@/server/storyboard/application/run-storyboard-generation';
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

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, { scope: 'storyboard' });
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  const platformContext = resolvePlatformRequestContext(request, {
    defaultPlan: getPlanHeaderDefault(request),
  });

  try {
    const runtime = getPlatformRuntime();
    const body = await request.json() as StoryboardGenerateRequest;
    const runtimeWorkspaceId = resolveRuntimeWorkspaceId(platformContext.workspaceId);
    const usageSnapshot = await runtime.usageMeter.snapshot(runtimeWorkspaceId);
    const activeJobs = await runtime.generationJobs.listActiveByWorkspaceId(runtimeWorkspaceId);
    const validationError = getStoryboardRequestError(body);
    if (validationError) {
      return createPlatformJsonErrorResponse(platformContext, validationError, 400);
    }

    const platformAccess = evaluatePlatformFeatureAccess(platformContext, {
      feature: 'storyboard-generation',
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
        pendingCharacterCount: body.scriptText?.length ?? 0,
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
      projectId: resolveRuntimeProjectId(platformContext.projectId, 'storyboard-generation'),
      kind: 'storyboard-generation',
      requestedByUserId: platformContext.userId,
      requestedBySessionId: platformContext.sessionId,
      modelName: llmConfig.modelName ?? null,
      inputSnapshot: {
        requestId: platformContext.requestId,
        sessionId: platformContext.sessionId,
        safeMode: body.safeMode ?? false,
        visualStyle: body.visualStyle ?? null,
        colorTone: body.colorTone ?? null,
        genreLabel: body.genreLabel ?? null,
      },
    });
    await runtime.generationJobs.markRunning(job.id, undefined, platformContext.userId);
    const accessToken = runtime.generationJobAccess.issue(job.id);

    const response = createSSEStreamResponse<StoryboardGenerationEvent>(
      async (send) => {
        try {
          await runStoryboardGeneration({
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
            outputSummary: 'Generated storyboard prompts',
            updatedByUserId: platformContext.userId,
          });
        } catch (error) {
          await runtime.generationJobs.markFailed(job.id, {
            errorMessage: error instanceof Error ? error.message : '分镜生成失败',
            updatedByUserId: platformContext.userId,
          });
          throw error;
        }
      },
      {
        onError: (error) => ({
          step: 'error',
          message: isContentPolicyError(error)
            ? '安全内容错误：输入内容被模型安全策略拦截，请删减过于露骨、血腥或违规的描述。'
            : error instanceof Error
              ? error.message
              : '生成分镜提示词失败，请检查后端 LLM 配置',
        }),
      }
    );
    response.headers.set('X-Generation-Job-Id', job.id);
    response.headers.set('X-Generation-Access-Token', accessToken);

    return applyPlatformResponseHeaders(response, platformContext);
  } catch (error) {
    console.error('Storyboard generation error:', platformContext.requestId, error);
    return createPlatformJsonErrorResponse(
      platformContext,
      error instanceof Error ? error.message : '请求失败',
      500
    );
  }
}

function isContentPolicyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return [
    'inappropriate content',
    'content policy',
    'content filter',
    'safety',
    'moderation',
    'sensitive',
    'unsafe',
    'violat',
  ].some((keyword) => message.includes(keyword));
}

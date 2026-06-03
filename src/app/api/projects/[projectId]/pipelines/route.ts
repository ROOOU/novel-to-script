import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GENRE_VALUES, SCRIPT_STYLE_VALUES } from '@/lib/types';
import { getServerLLMConfigError } from '@/lib/server-llm-config';
import { requireViewerResponse } from '@/server/auth/http';
import { viewerOwnsProject } from '@/server/auth/viewer-access';
import { shouldUseDevGenerationFallback } from '@/server/generation/dev-fallback';
import { createNovelToStoryboardPipeline } from '@/server/generation/pipeline-service';
import { evaluateStoryComplexity } from '@/server/story-engine/complexity';
import { getPlatformRuntime } from '@/server/shared/platform';

export const maxDuration = 300;

const pipelineSchema = z.object({
  mode: z.literal('novel-to-storyboard'),
  payload: z.object({
    text: z.string().min(1),
    genre: z.enum(GENRE_VALUES),
    config: z.object({
      genre: z.enum(GENRE_VALUES),
      episodeCount: z.number().int().min(1).max(20),
      episodeDuration: z.enum(['1:00-1:30', '1:30-2:00', '2:00-3:00']),
      style: z.enum(SCRIPT_STYLE_VALUES),
      includeDirectorNotes: z.boolean(),
    }),
    analysis: z
      .object({
        title: z.string(),
        genre: z.enum(GENRE_VALUES),
        characters: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            personality: z.string(),
            speechStyle: z.string(),
            relationships: z.array(z.string()),
          })
        ),
        plotSummary: z.string(),
        keyConflicts: z.array(z.string()),
        climaxPoints: z.array(z.string()),
        emotionalBeats: z.array(z.string()),
      })
      .optional(),
    mode: z.enum(['quick', 'longform']).optional(),
    targetOutput: z.enum(['script', 'prompt_pack', 'full_pipeline']).optional(),
    executionMode: z.enum(['direct', 'segmented']).optional(),
    storyboardConfig: z
      .object({
        visualStyle: z.string().optional(),
        colorTone: z.string().optional(),
        genreLabel: z.string().optional(),
        safeMode: z.boolean().optional(),
        targetPlatform: z.enum(['generic-video', 'seedance']).optional(),
      })
      .optional(),
  }),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const { projectId } = await params;
  const runtime = getPlatformRuntime();
  const project = await runtime.projects.getById(projectId);
  if (!project || !viewerOwnsProject(viewer, project)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'PROJECT_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  try {
    const body = pipelineSchema.parse(await request.json());
    const llmConfigError = getServerLLMConfigError();
    if (
      llmConfigError &&
      !shouldUseDevGenerationFallback({
        kind: 'script-generation',
        llmConfigError,
      })
    ) {
      throw new Error(llmConfigError);
    }
    const complexityInfo = evaluateStoryComplexity(body.payload.text);
    const executionMode = body.payload.executionMode ?? complexityInfo.recommendedExecutionMode;
    const pipeline = await createNovelToStoryboardPipeline({
      organizationId: viewer.organization.id,
      workspaceId: viewer.workspace.id,
      projectId,
      userId: viewer.user.id,
      body: {
        ...body.payload,
        complexityInfo,
        executionMode,
      },
    });

    return NextResponse.json({
      ok: true,
      pipeline,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PIPELINE_CREATE_FAILED';
    const status = message === 'INSUFFICIENT_CREDITS' ? 402 : 400;
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}

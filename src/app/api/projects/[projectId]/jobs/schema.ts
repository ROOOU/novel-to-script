import { z } from 'zod';
import { GENRE_VALUES, SCRIPT_STYLE_VALUES } from '@/lib/types';
import { VIDEO_ASPECT_RATIO_VALUES } from '@/features/video-generation/contracts';

export const generateConfigSchema = z.object({
  genre: z.enum(GENRE_VALUES),
  episodeCount: z.number().int().positive(),
  episodeDuration: z.enum(['1:00-1:30', '1:30-2:00', '2:00-3:00']),
  style: z.enum(SCRIPT_STYLE_VALUES),
  includeDirectorNotes: z.boolean().optional(),
});

export const scriptGenerationPayloadSchema = z.object({
  text: z.string().min(1),
  genre: z.enum(GENRE_VALUES),
  config: generateConfigSchema,
  analysis: z.record(z.string(), z.unknown()).optional(),
  mode: z.enum(['quick', 'longform']).optional(),
  targetOutput: z.enum(['script', 'prompt_pack', 'full_pipeline']).optional(),
  executionMode: z.enum(['direct', 'segmented']).optional(),
  complexityInfo: z
    .object({
      score: z.number(),
      textLength: z.number().int().nonnegative(),
      estimatedSceneBreaks: z.number().int().nonnegative(),
      estimatedTimeJumps: z.number().int().nonnegative(),
      estimatedPovSwitches: z.number().int().nonnegative(),
      estimatedCharacterDensity: z.number().int().nonnegative(),
      recommendedExecutionMode: z.enum(['direct', 'segmented']),
      chunkCount: z.number().int().positive(),
    })
    .optional(),
});

const storyboardGenerationPayloadSchema = z
  .object({
    scriptText: z.string().optional(),
    scriptArtifactIds: z.array(z.string().min(1)).optional(),
    scope: z.enum(['all', 'selection']).optional(),
    selection: z
      .object({
        artifactIds: z.array(z.string().min(1)).optional(),
        episodeNumbers: z.array(z.number().int().positive()).optional(),
        sceneIds: z.array(z.string().min(1)).optional(),
      })
      .optional(),
    visualStyle: z.string().optional(),
    colorTone: z.string().optional(),
    genreLabel: z.string().optional(),
    safeMode: z.boolean().optional(),
    targetPlatform: z.enum(['generic-video', 'seedance']).optional(),
  })
  .superRefine((value, ctx) => {
    const hasScriptText = (value.scriptText?.trim().length ?? 0) > 0;
    const hasScriptArtifactIds = (value.scriptArtifactIds?.length ?? 0) > 0;
    const hasSelectionArtifactIds = (value.selection?.artifactIds?.length ?? 0) > 0;
    const hasSelectionEpisodeNumbers = (value.selection?.episodeNumbers?.length ?? 0) > 0;
    const hasSelectionSceneIds = (value.selection?.sceneIds?.length ?? 0) > 0;
    const hasSelectionCriteria =
      hasSelectionArtifactIds || hasSelectionEpisodeNumbers || hasSelectionSceneIds;
    const canUseSelectionArtifacts = value.scope === 'selection' && hasSelectionArtifactIds;

    if (!hasScriptText && !hasScriptArtifactIds && !canUseSelectionArtifacts) {
      ctx.addIssue({
        code: 'custom',
        message: 'storyboard payload requires scriptText or scriptArtifactIds',
      });
    }

    if (value.scope === 'selection' && !hasSelectionCriteria) {
      ctx.addIssue({
        code: 'custom',
        message: 'storyboard payload requires selection criteria when scope=selection',
      });
    }

    if (
      value.scope === 'selection' &&
      !hasScriptArtifactIds &&
      !hasSelectionArtifactIds &&
      (hasSelectionEpisodeNumbers || hasSelectionSceneIds)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'storyboard selection by episode or scene requires scriptArtifactIds',
      });
    }
  });

const scriptGenerationJobSchema = z.object({
  kind: z.literal('script-generation'),
  payload: scriptGenerationPayloadSchema,
});

const storyboardGenerationJobSchema = z.object({
  kind: z.literal('storyboard-generation'),
  payload: storyboardGenerationPayloadSchema,
});

const videoGenerationPayloadSchema = z
  .object({
    shotPlanArtifactId: z.string().min(1),
    shotId: z.string().min(1),
    promptOverride: z.string().optional(),
    referenceImageArtifactIds: z.array(z.string().min(1)).max(3).optional(),
    firstFrameArtifactId: z.string().min(1).optional(),
    lastFrameArtifactId: z.string().min(1).optional(),
    aspectRatio: z.enum(VIDEO_ASPECT_RATIO_VALUES).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.firstFrameArtifactId && !value.lastFrameArtifactId) || (!value.firstFrameArtifactId && value.lastFrameArtifactId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'video payload requires both firstFrameArtifactId and lastFrameArtifactId',
      });
    }
  });

const videoGenerationJobSchema = z.object({
  kind: z.literal('video-generation'),
  payload: videoGenerationPayloadSchema,
});

export const createJobSchema = z.discriminatedUnion('kind', [
  scriptGenerationJobSchema,
  storyboardGenerationJobSchema,
  videoGenerationJobSchema,
]);

export type CreateJobInput = z.infer<typeof createJobSchema>;

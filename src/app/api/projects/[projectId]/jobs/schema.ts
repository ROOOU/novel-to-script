import { z } from 'zod';

const generateConfigSchema = z.object({
  genre: z.enum(['xianxia', 'urban', 'fantasy']),
  episodeCount: z.number().int().positive(),
  episodeDuration: z.enum(['1:00-1:30', '1:30-2:00', '2:00-3:00']),
  style: z.enum(['dramatic', 'comedic', 'suspense']),
  includeDirectorNotes: z.boolean().optional(),
});

const scriptGenerationPayloadSchema = z.object({
  text: z.string().min(1),
  genre: z.enum(['xianxia', 'urban', 'fantasy']),
  config: generateConfigSchema,
  analysis: z.record(z.string(), z.unknown()).optional(),
});

const storyboardGenerationPayloadSchema = z
  .object({
    scriptText: z.string().optional(),
    scriptArtifactIds: z.array(z.string().min(1)).optional(),
    visualStyle: z.string().optional(),
    colorTone: z.string().optional(),
    genreLabel: z.string().optional(),
    safeMode: z.boolean().optional(),
  })
  .refine((value) => (value.scriptText?.trim().length ?? 0) > 0 || (value.scriptArtifactIds?.length ?? 0) > 0, {
    message: 'storyboard payload requires scriptText or scriptArtifactIds',
  });

const scriptGenerationJobSchema = z.object({
  kind: z.literal('script-generation'),
  payload: scriptGenerationPayloadSchema,
});

const storyboardGenerationJobSchema = z.object({
  kind: z.literal('storyboard-generation'),
  payload: storyboardGenerationPayloadSchema,
});

export const createJobSchema = z.discriminatedUnion('kind', [
  scriptGenerationJobSchema,
  storyboardGenerationJobSchema,
]);

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const VIDEO_ASPECT_RATIO_VALUES = ['9:16', '16:9'] as const;

export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIO_VALUES)[number];

export interface VideoGenerationRequest {
  shotPlanArtifactId: string;
  shotId: string;
  promptOverride?: string;
  referenceImageArtifactIds?: string[];
  firstFrameArtifactId?: string;
  lastFrameArtifactId?: string;
  aspectRatio?: VideoAspectRatio;
}

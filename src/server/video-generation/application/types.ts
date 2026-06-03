import type { VideoGenerationRequest } from '@/features/video-generation/contracts';
import type { PlatformRequestContext } from '@/server/shared/platform';

export interface VideoGenerationExecutionOptions {
  body: VideoGenerationRequest;
  context: PlatformRequestContext;
  jobId?: string | null;
  onProgress?: (progress: VideoGenerationProgressUpdate) => Promise<void> | void;
  onArtifact?: (artifact: VideoGenerationArtifactRecord) => Promise<void> | void;
}

export interface VideoGenerationProgressUpdate {
  progress: number;
  currentStep: string;
  outputSummary?: string;
}

export interface VideoGenerationArtifactRecord {
  kind: 'video_clip';
  title: string;
  format: 'video/mp4';
  content?: string | null;
  storageKey?: string | null;
  checksum: string;
  metadata?: Record<string, unknown>;
}

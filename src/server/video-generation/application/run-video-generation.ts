import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleGenAI, type GenerateVideosOperation, type Image, VideoGenerationReferenceType } from '@google/genai';
import { findStoryboardShotById, parseStoryboardShotsFromContent } from '@/lib/storyboard-shots';
import { delay } from '@/lib/timing';
import { slugify } from '@/lib/slug';
import { getPlatformRuntime } from '@/server/shared/platform';
import { readStoredMedia, storeMediaBuffer } from '@/server/media/store';
import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_RESOLUTION,
  getGeminiApiKeyOrThrow,
  getVideoGenerationModel,
  getVideoPollIntervalMs,
  getVideoTimeoutMs,
} from '@/server/video-generation/config';
import type {
  VideoGenerationArtifactRecord,
  VideoGenerationExecutionOptions,
  VideoGenerationProgressUpdate,
} from './types';

export async function runVideoGeneration(input: VideoGenerationExecutionOptions) {
  const runtime = getPlatformRuntime();
  const shotPlanArtifact = await runtime.generationArtifacts.getById(input.body.shotPlanArtifactId);
  if (!shotPlanArtifact || shotPlanArtifact.kind !== 'shot_plan') {
    throw new Error('VIDEO_SHOT_PLAN_NOT_FOUND');
  }

  const shots = parseStoryboardShotsFromContent(shotPlanArtifact.content);
  const shot = findStoryboardShotById(shots, input.body.shotId);
  if (!shot) {
    throw new Error('VIDEO_SHOT_NOT_FOUND');
  }

  const prompt = resolvePrompt(shot, input.body.promptOverride);
  if (!prompt) {
    throw new Error('VIDEO_PROMPT_REQUIRED');
  }

  const referenceImages = await loadImageArtifacts(input.body.referenceImageArtifactIds ?? []);
  const firstFrame = input.body.firstFrameArtifactId
    ? await loadImageArtifact(input.body.firstFrameArtifactId)
    : null;
  const lastFrame = input.body.lastFrameArtifactId
    ? await loadImageArtifact(input.body.lastFrameArtifactId)
    : null;

  if ((firstFrame && !lastFrame) || (!firstFrame && lastFrame)) {
    throw new Error('VIDEO_FRAME_PAIR_REQUIRED');
  }

  const ai = new GoogleGenAI({
    apiKey: getGeminiApiKeyOrThrow(),
  });

  await input.onProgress?.({
    progress: 8,
    currentStep: 'submitting',
    outputSummary: `Submitting video generation for ${shot.shotId}`,
  });

  let operation = await ai.models.generateVideos({
    model: getVideoGenerationModel(),
    source: {
      prompt,
      ...(firstFrame ? { image: firstFrame.image } : {}),
    },
    config: {
      numberOfVideos: 1,
      durationSeconds: DEFAULT_VIDEO_DURATION_SECONDS,
      resolution: DEFAULT_VIDEO_RESOLUTION,
      aspectRatio: input.body.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
      ...(firstFrame && lastFrame ? { lastFrame: lastFrame.image } : {}),
      ...(referenceImages.length > 0
        ? {
            personGeneration: 'allow_adult',
            referenceImages: referenceImages.map((entry) => ({
              image: entry.image,
              referenceType: VideoGenerationReferenceType.ASSET,
            })),
          }
        : {}),
    },
  });

  operation = await pollVideoOperation({
    ai,
    operation,
    shotId: shot.shotId,
    onProgress: input.onProgress,
  });

  const generatedVideo = operation.response?.generatedVideos?.[0]?.video;
  if (!generatedVideo) {
    throw new Error('VIDEO_PROVIDER_EMPTY_RESPONSE');
  }

  await input.onProgress?.({
    progress: 85,
    currentStep: 'downloading',
    outputSummary: `Downloading generated video for ${shot.shotId}`,
  });

  const videoBuffer = await downloadGeneratedVideo({
    ai,
    video: generatedVideo,
  });
  const storedVideo = await storeMediaBuffer({
    buffer: videoBuffer,
    extension: 'mp4',
    prefix: 'videos',
  });

  const artifact = buildVideoArtifactRecord({
    shot,
    body: input.body,
    prompt,
    operation,
    byteSize: storedVideo.byteSize,
    content: storedVideo.content,
    contentEncoding: storedVideo.contentEncoding,
    storageKey: storedVideo.storageKey,
    checksum: storedVideo.checksum,
  });

  await input.onArtifact?.(artifact);
  await input.onProgress?.({
    progress: 100,
    currentStep: 'done',
    outputSummary: `Video generated for ${shot.shotId}`,
  });
}

async function pollVideoOperation(input: {
  ai: GoogleGenAI;
  operation: GenerateVideosOperation;
  shotId: string;
  onProgress?: (progress: VideoGenerationProgressUpdate) => Promise<void> | void;
}) {
  const startedAt = Date.now();
  let operation = input.operation;

  while (!operation.done) {
    if (Date.now() - startedAt > getVideoTimeoutMs()) {
      throw new Error('VIDEO_OPERATION_TIMEOUT');
    }

    await input.onProgress?.({
      progress: 40,
      currentStep: 'polling',
      outputSummary: `Waiting for Veo to finish ${input.shotId}`,
    });
    await delay(getVideoPollIntervalMs());
    operation = await input.ai.operations.getVideosOperation({ operation });
  }

  if (operation.error) {
    throw new Error(readOperationError(operation.error));
  }

  return operation;
}

async function loadImageArtifacts(artifactIds: string[]) {
  const uniqueArtifactIds = Array.from(new Set(artifactIds.filter(Boolean)));
  return Promise.all(uniqueArtifactIds.map((artifactId) => loadImageArtifact(artifactId)));
}

async function loadImageArtifact(artifactId: string) {
  const runtime = getPlatformRuntime();
  const artifact = await runtime.generationArtifacts.getById(artifactId);
  if (!artifact || artifact.kind !== 'reference_image' || !artifact.storageKey) {
    if (artifact?.kind === 'reference_image' && artifact.content && artifact.metadata?.contentEncoding === 'base64') {
      return {
        artifact,
        image: {
          imageBytes: artifact.content,
          mimeType: artifact.format,
        } satisfies Image,
      };
    }

    throw new Error(`VIDEO_REFERENCE_IMAGE_NOT_FOUND:${artifactId}`);
  }

  const { buffer } = await readStoredMedia(artifact.storageKey);
  return {
    artifact,
    image: {
      imageBytes: buffer.toString('base64'),
      mimeType: artifact.format,
    } satisfies Image,
  };
}

async function downloadGeneratedVideo(input: {
  ai: GoogleGenAI;
  video: { uri?: string; videoBytes?: string; mimeType?: string };
}) {
  const { ai, video } = input;
  if (video.videoBytes) {
    return Buffer.from(video.videoBytes, 'base64');
  }

  if (!video.uri) {
    throw new Error('VIDEO_PROVIDER_DOWNLOAD_URI_MISSING');
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-veo-download-'));
  const downloadPath = path.join(tempDir, 'generated-video.mp4');

  try {
    await ai.files.download({
      file: video as Parameters<GoogleGenAI['files']['download']>[0]['file'],
      downloadPath,
    });
    return await readFile(downloadPath);
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown';
    throw new Error(`VIDEO_PROVIDER_DOWNLOAD_FAILED:${message}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function buildVideoArtifactRecord(input: {
  shot: { shotId: string; videoPrompt: string; sceneId: string };
  body: VideoGenerationExecutionOptions['body'];
  prompt: string;
  operation: GenerateVideosOperation;
  byteSize: number;
  content?: string | null;
  contentEncoding?: 'base64' | null;
  storageKey?: string | null;
  checksum: string;
}): VideoGenerationArtifactRecord {
  const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const providerVideoUri = input.operation.response?.generatedVideos?.[0]?.video?.uri ?? null;
  const providerVideoName = providerVideoUri ? providerVideoUri.split('/').pop()?.split('?')[0] ?? null : null;
  const titleBase = slugify(input.shot.shotId || 'video-clip') || 'video-clip';

  return {
    kind: 'video_clip',
    title: `${input.shot.shotId || '镜头'} 视频`,
    format: 'video/mp4',
    content: input.content ?? null,
    storageKey: input.storageKey,
    checksum: input.checksum,
    metadata: {
      provider: 'gemini',
      model: getVideoGenerationModel(),
      sourceShotId: input.body.shotId,
      sourceShotPlanArtifactId: input.body.shotPlanArtifactId,
      referenceImageArtifactIds: input.body.referenceImageArtifactIds ?? [],
      firstFrameArtifactId: input.body.firstFrameArtifactId ?? null,
      lastFrameArtifactId: input.body.lastFrameArtifactId ?? null,
      providerOperationName: input.operation.name ?? null,
      providerVideoName,
      providerVideoUri,
      providerExpiresAt: expiresAt,
      prompt: input.prompt,
      ...(input.contentEncoding ? { contentEncoding: input.contentEncoding } : {}),
      byteSize: input.byteSize,
      downloadFilename: `${titleBase}.mp4`,
      durationSeconds: DEFAULT_VIDEO_DURATION_SECONDS,
      resolution: DEFAULT_VIDEO_RESOLUTION,
      aspectRatio: input.body.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO,
    },
  };
}

function resolvePrompt(
  shot: {
    videoPrompt: string;
    subject: string;
    environment: string;
    shotType: string;
    motion: string;
    lighting: string;
  },
  promptOverride?: string
) {
  const override = promptOverride?.trim();
  if (override) {
    return override;
  }

  if (shot.videoPrompt.trim()) {
    return shot.videoPrompt.trim();
  }

  return [shot.environment, shot.shotType, shot.subject, shot.motion, shot.lighting]
    .map((value) => value.trim())
    .filter(Boolean)
    .join('，');
}

function readOperationError(error: Record<string, unknown>) {
  if (typeof error.message === 'string' && error.message.trim()) {
    return `VIDEO_PROVIDER_ERROR:${error.message.trim()}`;
  }

  if (typeof error.code === 'string' && error.code.trim()) {
    return `VIDEO_PROVIDER_ERROR:${error.code.trim()}`;
  }

  return 'VIDEO_PROVIDER_ERROR';
}

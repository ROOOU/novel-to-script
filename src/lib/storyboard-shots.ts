import type { StoryboardShot } from '@/server/shared/platform/domain';

export function parseStoryboardShotsFromContent(content?: string | null): StoryboardShot[] {
  if (typeof content !== 'string' || !content.trim()) {
    return [];
  }

  try {
    return readStoryboardShots(JSON.parse(content) as unknown);
  } catch {
    return [];
  }
}

export function readStoryboardShots(value: unknown): StoryboardShot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const sceneId = readShotField(candidate.sceneId);
    const shotId = readShotField(candidate.shotId);
    const shotType = readShotField(candidate.shotType);
    const camera = readShotField(candidate.camera);
    const composition = readShotField(candidate.composition);
    const motion = readShotField(candidate.motion);
    const subject = readShotField(candidate.subject);
    const environment = readShotField(candidate.environment);
    const lighting = readShotField(candidate.lighting);
    const audioHint = readShotField(candidate.audioHint);
    const videoPrompt = readShotField(candidate.videoPrompt);

    if (!sceneId && !shotId && !shotType && !videoPrompt) {
      return [];
    }

    return [
      {
        sceneId,
        shotId,
        shotType,
        camera,
        composition,
        motion,
        subject,
        environment,
        lighting,
        audioHint,
        videoPrompt,
      },
    ];
  });
}

export function findStoryboardShotById(
  shots: StoryboardShot[],
  shotId: string
): StoryboardShot | null {
  const normalizedShotId = shotId.trim().toLowerCase();
  if (!normalizedShotId) {
    return null;
  }

  return (
    shots.find((shot) => shot.shotId.trim().toLowerCase() === normalizedShotId) ?? null
  );
}

function readShotField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

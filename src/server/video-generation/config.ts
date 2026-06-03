export const DEFAULT_VIDEO_MODEL = 'veo-3.1-generate-preview';
export const DEFAULT_VIDEO_ASPECT_RATIO = '9:16';
export const DEFAULT_VIDEO_DURATION_SECONDS = 8;
export const DEFAULT_VIDEO_RESOLUTION = '720p';
export const DEFAULT_VIDEO_POLL_INTERVAL_MS = 10_000;
export const DEFAULT_VIDEO_TIMEOUT_MS = 8 * 60 * 1000;

export function isVideoGenerationEnabled() {
  return (
    process.env.NOVELSCRIPT_ENABLE_VIDEO_GENERATION === 'true' &&
    Boolean(process.env.GEMINI_API_KEY?.trim())
  );
}

export function getGeminiApiKeyOrThrow() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('VIDEO_PROVIDER_NOT_CONFIGURED');
  }

  return apiKey;
}

export function getVideoGenerationModel() {
  return process.env.NOVELSCRIPT_VIDEO_MODEL?.trim() || DEFAULT_VIDEO_MODEL;
}

export function getVideoPollIntervalMs() {
  const parsed = Number(process.env.NOVELSCRIPT_VIDEO_POLL_INTERVAL_MS ?? DEFAULT_VIDEO_POLL_INTERVAL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VIDEO_POLL_INTERVAL_MS;
}

export function getVideoTimeoutMs() {
  const parsed = Number(process.env.NOVELSCRIPT_VIDEO_TIMEOUT_MS ?? DEFAULT_VIDEO_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VIDEO_TIMEOUT_MS;
}

export function getConfiguredVideoJobCredits() {
  const parsed = Number(process.env.NOVELSCRIPT_VIDEO_JOB_CREDITS ?? '0');
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

export const DEFAULT_LLM_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_LLM_TIMEOUT_MS = 120_000;
export const DEFAULT_LLM_MAX_RETRIES = 2;
export const DEFAULT_LLM_RETRY_BASE_DELAY_MS = 500;

const STALE_GENERATION_RECOVERY_BUFFER_MS = 30_000;

const VERSION_PATH_RE = /\/v\d+$/;
const KNOWN_ENDPOINT_SUFFIX_RE = /\/(?:chat\/completions|responses|completions|embeddings|audio\/transcriptions)$/;
const KNOWN_GATEWAY_ROOT_SUFFIX_RE = /\/v\d+\/endpoints$/;
const LLM_FALLBACK_ENV_KEYS = ['LLM_FALLBACKS', 'LLM_FALLBACKS_JSON'] as const;

export interface LLMFallbackConfig {
  apiKey: string;
  baseUrl?: string;
  modelName?: string;
  timeoutMs?: number;
  label?: string;
}

function normalizeBasePath(pathname: string): string {
  const trimmedPath = pathname.replace(/\/+$/, '');
  const withoutEndpoint = trimmedPath.replace(KNOWN_ENDPOINT_SUFFIX_RE, '');

  if (!withoutEndpoint || withoutEndpoint === '/') {
    return '/v1';
  }

  if (VERSION_PATH_RE.test(withoutEndpoint)) {
    return withoutEndpoint;
  }

  if (KNOWN_GATEWAY_ROOT_SUFFIX_RE.test(withoutEndpoint)) {
    return withoutEndpoint;
  }

  return `${withoutEndpoint}/v1`;
}

/**
 * 规范化 LLM 网关 Base URL。
 * 自动补齐缺失的 `/v1`，并把误填的完整 endpoint 收敛为 API 根路径。
 */
export function normalizeLLMBaseUrl(baseUrl?: string): string {
  const rawBaseUrl = baseUrl?.trim();
  if (!rawBaseUrl) {
    return DEFAULT_LLM_BASE_URL;
  }

  try {
    const url = new URL(rawBaseUrl);
    url.pathname = normalizeBasePath(url.pathname);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawBaseUrl;
  }
}

export function getMinimumStaleGenerationRecoveryWindowMs(): number {
  const maxAttempts = DEFAULT_LLM_MAX_RETRIES + 1;
  const retryDelayBudget = Array.from({ length: DEFAULT_LLM_MAX_RETRIES }, (_, attempt) =>
    DEFAULT_LLM_RETRY_BASE_DELAY_MS * (2 ** attempt)
  ).reduce((total, delay) => total + delay, 0);

  return DEFAULT_LLM_TIMEOUT_MS * maxAttempts + retryDelayBudget + STALE_GENERATION_RECOVERY_BUFFER_MS;
}

export function resolveStaleGenerationRecoveryWindowMs(
  value?: string | number | null
): number {
  const defaultWindow = getMinimumStaleGenerationRecoveryWindowMs();
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return defaultWindow;
  }

  return Math.max(parsedValue, defaultWindow);
}

export function parseLLMFallbackConfigsFromEnv(env: NodeJS.ProcessEnv = process.env): LLMFallbackConfig[] {
  const rawValue = LLM_FALLBACK_ENV_KEYS
    .map((key) => env[key]?.trim())
    .find((value) => Boolean(value));

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry, index) => {
      if (!isRecord(entry)) {
        return [];
      }

      const apiKey = typeof entry.apiKey === 'string' ? entry.apiKey.trim() : '';
      if (!apiKey) {
        return [];
      }

      const baseUrl = typeof entry.baseUrl === 'string' && entry.baseUrl.trim()
        ? normalizeLLMBaseUrl(entry.baseUrl)
        : undefined;
      const modelName = typeof entry.modelName === 'string' && entry.modelName.trim()
        ? entry.modelName.trim()
        : undefined;
      const timeoutMs =
        typeof entry.timeoutMs === 'number' && Number.isFinite(entry.timeoutMs) && entry.timeoutMs > 0
          ? entry.timeoutMs
          : undefined;
      const label = typeof entry.label === 'string' && entry.label.trim()
        ? entry.label.trim()
        : `fallback-${index + 1}`;

      return [{
        apiKey,
        ...(baseUrl ? { baseUrl } : {}),
        ...(modelName ? { modelName } : {}),
        ...(timeoutMs ? { timeoutMs } : {}),
        label,
      } satisfies LLMFallbackConfig];
    });
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

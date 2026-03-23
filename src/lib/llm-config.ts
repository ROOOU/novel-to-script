export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

const VERSION_PATH_RE = /\/v\d+$/;
const KNOWN_ENDPOINT_SUFFIX_RE = /\/(?:chat\/completions|responses|completions|embeddings|audio\/transcriptions)$/;

function normalizeBasePath(pathname: string): string {
  const trimmedPath = pathname.replace(/\/+$/, '');
  const withoutEndpoint = trimmedPath.replace(KNOWN_ENDPOINT_SUFFIX_RE, '');

  if (!withoutEndpoint || withoutEndpoint === '/') {
    return '/v1';
  }

  if (VERSION_PATH_RE.test(withoutEndpoint)) {
    return withoutEndpoint;
  }

  return `${withoutEndpoint}/v1`;
}

/**
 * 规范化 OpenAI-compatible Base URL。
 * 自动补齐缺失的 `/v1`，并把误填的完整 endpoint 收敛为 API 根路径。
 */
export function normalizeOpenAIBaseUrl(baseUrl?: string): string {
  const rawBaseUrl = baseUrl?.trim();
  if (!rawBaseUrl) {
    return DEFAULT_OPENAI_BASE_URL;
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

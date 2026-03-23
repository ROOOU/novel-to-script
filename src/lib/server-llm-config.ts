const SERVER_API_KEY_ENV_KEYS = ['OPENAI_API_KEY', 'API_KEY'] as const;

/**
 * 返回当前是否已在服务端配置 LLM 所需的 API Key。
 */
export function hasServerLLMApiKey(): boolean {
  return SERVER_API_KEY_ENV_KEYS.some((key) => Boolean(process.env[key]?.trim()));
}

/**
 * 返回缺失服务端 LLM 配置时给前端展示的错误信息。
 */
export function getServerLLMConfigError(): string | null {
  if (hasServerLLMApiKey()) {
    return null;
  }

  return '服务端未配置 LLM API Key，请在后端环境变量中设置 OPENAI_API_KEY 或 API_KEY。';
}

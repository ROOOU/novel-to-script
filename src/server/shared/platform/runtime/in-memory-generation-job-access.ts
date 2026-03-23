const jobAccessTokens = new Map<string, string>();

export interface GenerationJobAccessStore {
  issue(jobId: string): string;
  verify(jobId: string, token: string | null | undefined): boolean;
  revoke(jobId: string): void;
}

export function createInMemoryGenerationJobAccessStore(): GenerationJobAccessStore {
  return {
    issue(jobId) {
      const token = createAccessToken();
      jobAccessTokens.set(jobId, token);
      return token;
    },
    verify(jobId, token) {
      if (!token) {
        return false;
      }

      return jobAccessTokens.get(jobId) === token;
    },
    revoke(jobId) {
      jobAccessTokens.delete(jobId);
    },
  };
}

export function resetInMemoryGenerationJobAccessStore(): void {
  jobAccessTokens.clear();
}

function createAccessToken(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

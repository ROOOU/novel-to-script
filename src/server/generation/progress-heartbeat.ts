export interface ProgressHeartbeatInput {
  progress: number;
  currentStep: string;
  outputSummary?: string;
}

export interface ProgressHeartbeatOptions extends ProgressHeartbeatInput {
  onProgress?: (progress: ProgressHeartbeatInput) => Promise<void> | void;
  intervalMs?: number;
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

export async function withProgressHeartbeat<T>(
  options: ProgressHeartbeatOptions,
  task: () => Promise<T>
): Promise<T> {
  if (!options.onProgress) {
    return task();
  }

  const intervalMs = options.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  let active = true;
  let timer: ReturnType<typeof setInterval> | null = null;

  if (intervalMs > 0) {
    timer = setInterval(() => {
      if (!active) {
        return;
      }

      void options.onProgress?.({
        progress: options.progress,
        currentStep: options.currentStep,
        outputSummary: options.outputSummary,
      });
    }, intervalMs);
  }

  try {
    return await task();
  } finally {
    active = false;
    if (timer) {
      clearInterval(timer);
    }
  }
}

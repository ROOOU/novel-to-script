import { describe, expect, it, vi } from 'vitest';
import { withProgressHeartbeat } from '@/server/generation/progress-heartbeat';

describe('withProgressHeartbeat', () => {
  it('emits heartbeat updates while a long task is pending', async () => {
    vi.useFakeTimers();
    const onProgress = vi.fn();

    const task = withProgressHeartbeat(
      {
        onProgress,
        progress: 15,
        currentStep: 'analyzing',
        intervalMs: 1_000,
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2_500));
        return 'done';
      }
    );

    await vi.advanceTimersByTimeAsync(2_500);
    await expect(task).resolves.toBe('done');
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      progress: 15,
      currentStep: 'analyzing',
      outputSummary: undefined,
    });
    vi.useRealTimers();
  });
});

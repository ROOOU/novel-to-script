import { describe, expect, it, vi } from 'vitest';
import { delay } from '@/lib/timing';

describe('delay', () => {
  it('resolves after the requested delay', async () => {
    vi.useFakeTimers();
    const promise = delay(5);

    await vi.advanceTimersByTimeAsync(5);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

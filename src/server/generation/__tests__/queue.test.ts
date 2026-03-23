import { describe, expect, it, vi } from 'vitest';
import { createProjectGenerationScheduler } from '@/server/generation/queue';

describe('createProjectGenerationScheduler', () => {
  it('falls back to inline scheduling when REDIS_URL is missing', async () => {
    const inlineScheduler = vi.fn();
    const queueFactory = vi.fn();
    const workerFactory = vi.fn();
    const scheduler = createProjectGenerationScheduler({
      env: {} as Pick<NodeJS.ProcessEnv, 'REDIS_URL'>,
      inlineScheduler,
      queueFactory,
      workerFactory,
    });

    await scheduler.schedule('job_inline');

    expect(scheduler.getMode()).toBe('inline');
    expect(inlineScheduler).toHaveBeenCalledWith('job_inline');
    expect(queueFactory).not.toHaveBeenCalled();
    expect(workerFactory).not.toHaveBeenCalled();
  });

  it('enqueues jobs through BullMQ when REDIS_URL is configured', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const queueFactory = vi.fn(() => ({ add, close }));
    const workerFactory = vi.fn(() => ({ close }));
    const scheduler = createProjectGenerationScheduler({
      env: { REDIS_URL: 'redis://localhost:6379' },
      queueFactory,
      workerFactory,
    });

    await scheduler.schedule('job_bullmq');

    expect(scheduler.getMode()).toBe('bullmq');
    expect(queueFactory).toHaveBeenCalledTimes(1);
    expect(workerFactory).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      'process-project-generation',
      { jobId: 'job_bullmq' },
      expect.objectContaining({
        jobId: 'job_bullmq',
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: 100,
      })
    );
  });

  it('falls back to inline scheduling when BullMQ enqueue fails', async () => {
    const inlineScheduler = vi.fn();
    const add = vi.fn().mockRejectedValue(new Error('redis unavailable'));
    const close = vi.fn().mockResolvedValue(undefined);
    const queueFactory = vi.fn(() => ({ add, close }));
    const workerFactory = vi.fn(() => ({ close }));
    const scheduler = createProjectGenerationScheduler({
      env: { REDIS_URL: 'redis://localhost:6379' },
      inlineScheduler,
      queueFactory,
      workerFactory,
    });

    await scheduler.schedule('job_fallback');

    expect(scheduler.getMode()).toBe('inline');
    expect(inlineScheduler).toHaveBeenCalledWith('job_fallback');
  });
});

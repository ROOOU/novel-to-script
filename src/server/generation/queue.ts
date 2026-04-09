import { after } from 'next/server';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

export type ProjectGenerationQueueMode = 'inline' | 'bullmq';

export interface ProjectGenerationScheduler {
  schedule(jobId: string): Promise<void>;
  close(): Promise<void>;
  getMode(): ProjectGenerationQueueMode;
}

type QueueLike = Pick<Queue, 'add' | 'close'>;
type WorkerLike = Pick<Worker, 'close'>;

interface ProjectGenerationQueueDependencies {
  env?: Pick<NodeJS.ProcessEnv, 'REDIS_URL'>;
  logger?: Pick<Console, 'warn' | 'error'>;
  inlineScheduler?: (jobId: string) => void;
  queueFactory?: (redisUrl: string) => QueueLike;
  workerFactory?: (redisUrl: string, processor: (jobId: string) => Promise<void>) => WorkerLike;
}

const QUEUE_NAME = 'project-generation';
const JOB_NAME = 'process-project-generation';
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: 100,
};

let schedulerSingleton: ProjectGenerationScheduler | null = null;

export function getProjectGenerationScheduler() {
  if (!schedulerSingleton) {
    schedulerSingleton = createProjectGenerationScheduler();
  }

  return schedulerSingleton;
}

export function resetProjectGenerationSchedulerForTests() {
  schedulerSingleton?.close().catch(() => undefined);
  schedulerSingleton = null;
}

export function createProjectGenerationScheduler(
  dependencies: ProjectGenerationQueueDependencies = {}
): ProjectGenerationScheduler {
  const env = dependencies.env ?? process.env;
  const redisUrl = env.REDIS_URL?.trim();
  const logger = dependencies.logger ?? console;
  const queueFactory = dependencies.queueFactory ?? createBullmqQueue;
  const workerFactory = dependencies.workerFactory ?? createBullmqWorker;
  const inlineScheduler = dependencies.inlineScheduler ?? ((jobId: string) => {
    try {
      after(async () => {
        await processQueuedProjectGenerationJob(jobId);
      });
    } catch {
      queueMicrotask(() => {
        void processQueuedProjectGenerationJob(jobId);
      });
    }
  });

  let queue: QueueLike | null = null;
  let worker: WorkerLike | null = null;
  let mode: ProjectGenerationQueueMode = redisUrl ? 'bullmq' : 'inline';

  async function ensureRedisQueue() {
    if (!redisUrl) {
      return;
    }

    if (!queue) {
      queue = queueFactory(redisUrl);
    }

    if (!worker) {
      worker = workerFactory(redisUrl, processQueuedProjectGenerationJob);
    }
  }

  return {
    async schedule(jobId: string) {
      if (!redisUrl) {
        inlineScheduler(jobId);
        mode = 'inline';
        return;
      }

      try {
        await ensureRedisQueue();
        await queue!.add(
          JOB_NAME,
          { jobId },
          {
            ...DEFAULT_JOB_OPTIONS,
            jobId,
          }
        );
        mode = 'bullmq';
      } catch (error) {
        logger.warn?.(
          `[novelscript] BullMQ queue unavailable, falling back to inline generation for ${jobId}`,
          error
        );
        inlineScheduler(jobId);
        mode = 'inline';
      }
    },
    async close() {
      await Promise.allSettled([queue?.close(), worker?.close()]);
    },
    getMode() {
      return mode;
    },
  };
}

async function processQueuedProjectGenerationJob(jobId: string) {
  const { processPersistedGenerationJob } = await import('./processor');
  await processPersistedGenerationJob(jobId);
}

function createBullmqQueue(redisUrl: string): QueueLike {
  const queue = new Queue(QUEUE_NAME, {
    connection: createBullmqConnection(redisUrl),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  return {
    add: (name, data, options) => queue.add(name, data, options),
    close: async () => {
      await queue.close();
    },
  };
}

function createBullmqWorker(
  redisUrl: string,
  processor: (jobId: string) => Promise<void>
): WorkerLike {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const jobId = job.data?.jobId;
      if (typeof jobId !== 'string' || !jobId) {
        throw new Error('PROJECT_GENERATION_JOB_ID_MISSING');
      }

      await processor(jobId);
    },
    {
      connection: createBullmqConnection(redisUrl),
      concurrency: 2,
    }
  );

  return {
    close: async () => {
      await worker.close();
    },
  };
}

function createBullmqConnection(redisUrl: string): ConnectionOptions {
  return {
    url: redisUrl,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    skipVersionCheck: true,
  };
}

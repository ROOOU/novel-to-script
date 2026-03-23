export * from './file-store';
export * from './in-memory-generation-artifacts';
export * from './in-memory-generation-job-access';
export * from './in-memory-generation-jobs';
export * from './in-memory-usage-meter';
export * from './persistent-runtime';
export * from '../db';

import { createInMemoryGenerationJobAccessStore } from './in-memory-generation-job-access';
import { type UsageMeter } from '@/server/shared/platform/policies';
import { createInMemoryUsageMeter } from './in-memory-usage-meter';
import { createDatabasePlatformRuntime, shouldUseDatabaseRuntime } from '../db';
import { createPersistentPlatformRuntime } from './persistent-runtime';

let cachedRepositories: ReturnType<typeof createPersistentPlatformRuntime> | NonNullable<ReturnType<typeof createDatabasePlatformRuntime>> | null = null;
let cachedBackend: 'database' | 'file' | null = null;
const generationJobAccess = createInMemoryGenerationJobAccessStore();
const usageMeter: UsageMeter = createInMemoryUsageMeter();

export function getPlatformRuntime() {
  const backend = shouldUseDatabaseRuntime() ? 'database' : 'file';
  if (!cachedRepositories || cachedBackend !== backend) {
    cachedRepositories =
      backend === 'database'
        ? createDatabasePlatformRuntime() ?? createPersistentPlatformRuntime()
        : createPersistentPlatformRuntime();
    cachedBackend = backend;
  }

  return {
    ...cachedRepositories,
    generationJobAccess,
    usageMeter,
  };
}

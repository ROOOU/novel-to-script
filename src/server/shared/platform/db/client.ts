import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { platformSchema } from './schema';

export type DatabaseClient = PostgresJsDatabase<typeof platformSchema>;

let cachedDatabase: DatabaseClient | null = null;
let cachedClient: ReturnType<typeof postgres> | null = null;

export function shouldUseDatabaseRuntime(databaseUrl = process.env.DATABASE_URL): boolean {
  return Boolean(databaseUrl?.trim());
}

export function getDatabaseClient(): DatabaseClient {
  if (!shouldUseDatabaseRuntime()) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!cachedDatabase) {
    cachedDatabase = createDatabaseClient();
  }

  return cachedDatabase;
}

export function tryGetDatabaseClient(): DatabaseClient | null {
  try {
    return getDatabaseClient();
  } catch {
    return null;
  }
}

export function hasDatabaseConnection(): boolean {
  return cachedDatabase !== null;
}

function createDatabaseClient(): DatabaseClient {
  if (!cachedClient) {
    cachedClient = postgres(process.env.DATABASE_URL as string, {
      max: Number(process.env.DATABASE_POOL_SIZE ?? '1'),
      idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT ?? '20'),
      connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT ?? '10'),
    });
  }

  return drizzle(cachedClient, {
    schema: platformSchema,
  }) as DatabaseClient;
}

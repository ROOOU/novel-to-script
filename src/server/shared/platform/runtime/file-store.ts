import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import type {
  ArtifactRelation,
  CreditAccount,
  CreditLedgerEntry,
  GenerationArtifact,
  GenerationJob,
  Organization,
  PaymentOrder,
  Project,
  RedeemCode,
  RedeemCodeCampaign,
  RedeemCodeRedemption,
  SourceDocument,
  Subscription,
  UsageEvent,
  User,
  Workspace,
} from '@/server/shared/platform/domain';
import { getDatabaseClient, shouldUseDatabaseRuntime } from '@/server/shared/platform/db/client';
import { platformStoreSnapshotsTable } from '@/server/shared/platform/db/schema';

export interface PlatformStoreData {
  version: number;
  users: User[];
  organizations: Organization[];
  workspaces: Workspace[];
  projects: Project[];
  sourceDocuments: SourceDocument[];
  generationJobs: GenerationJob[];
  generationArtifacts: GenerationArtifact[];
  artifactRelations: ArtifactRelation[];
  usageEvents: UsageEvent[];
  subscriptions: Subscription[];
  paymentOrders: PaymentOrder[];
  creditAccounts: CreditAccount[];
  creditLedgerEntries: CreditLedgerEntry[];
  redeemCodeCampaigns: RedeemCodeCampaign[];
  redeemCodes: RedeemCode[];
  redeemCodeRedemptions: RedeemCodeRedemption[];
}

const STORE_VERSION = 1;
const PRIMARY_STORE_KEY = 'primary';
const STORE_CACHE_TTL_MS = Number(process.env.NOVELSCRIPT_STORE_CACHE_TTL_MS ?? '800');
const DEFAULT_DATA: PlatformStoreData = {
  version: STORE_VERSION,
  users: [],
  organizations: [],
  workspaces: [],
  projects: [],
  sourceDocuments: [],
  generationJobs: [],
  generationArtifacts: [],
  artifactRelations: [],
  usageEvents: [],
  subscriptions: [],
  paymentOrders: [],
  creditAccounts: [],
  creditLedgerEntries: [],
  redeemCodeCampaigns: [],
  redeemCodes: [],
  redeemCodeRedemptions: [],
};

let writeChain = Promise.resolve();
let cachedDatabaseStore: PlatformStoreData | null = null;
let cachedDatabaseStoreLoadedAt = 0;
let cachedDatabaseStorePromise: Promise<PlatformStoreData> | null = null;

export async function readPlatformStore(): Promise<PlatformStoreData> {
  if (shouldUseDatabaseRuntime()) {
    return readPlatformStoreFromDatabase();
  }

  const storePath = getPlatformStorePath();

  try {
    const raw = await readFile(storePath, 'utf8');
    return normalizeStore(JSON.parse(raw) as Partial<PlatformStoreData>);
  } catch (error) {
    if (isMissingFile(error)) {
      await ensurePlatformStore();
      return cloneDefaultStore();
    }
    throw error;
  }
}

export async function updatePlatformStore<T>(
  mutator: (draft: PlatformStoreData) => Promise<T> | T
): Promise<T> {
  if (shouldUseDatabaseRuntime()) {
    const nextRun = writeChain.then(async () => {
      const current = await readPlatformStoreFromDatabase();
      const result = await mutator(current);
      await persistPlatformStoreToDatabase(current);
      return result;
    });

    writeChain = nextRun.then(() => undefined, () => undefined);
    return nextRun;
  }

  const nextRun = writeChain.then(async () => {
    const current = await readPlatformStore();
    const result = await mutator(current);
    await persistPlatformStore(current);
    return result;
  });

  writeChain = nextRun.then(() => undefined, () => undefined);
  return nextRun;
}

export function getPlatformStorePath(): string {
  return (
    process.env.NOVELSCRIPT_STORE_PATH ||
    path.join(process.cwd(), '.novelscript', 'store.json')
  );
}

export function createEntityId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export function getNowTimestamp(): string {
  return new Date().toISOString();
}

async function ensurePlatformStore(): Promise<void> {
  const storePath = getPlatformStorePath();
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
}

async function persistPlatformStore(data: PlatformStoreData): Promise<void> {
  const storePath = getPlatformStorePath();
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(data, null, 2), 'utf8');
}

async function readPlatformStoreFromDatabase(): Promise<PlatformStoreData> {
  const now = Date.now();
  if (cachedDatabaseStore && now - cachedDatabaseStoreLoadedAt < STORE_CACHE_TTL_MS) {
    return cachedDatabaseStore;
  }

  if (cachedDatabaseStorePromise) {
    return cachedDatabaseStorePromise;
  }

  cachedDatabaseStorePromise = readPlatformStoreSnapshotFromDatabase()
    .then((store) => {
      cachedDatabaseStore = store;
      cachedDatabaseStoreLoadedAt = Date.now();
      return store;
    })
    .finally(() => {
      cachedDatabaseStorePromise = null;
    });

  return cachedDatabaseStorePromise;
}

async function readPlatformStoreSnapshotFromDatabase(): Promise<PlatformStoreData> {
  const db = getDatabaseClient();
  await ensurePlatformStoreSnapshotTable();

  const rows = await db
    .select({
      version: platformStoreSnapshotsTable.version,
      payload: platformStoreSnapshotsTable.payload,
    })
    .from(platformStoreSnapshotsTable)
    .where(eq(platformStoreSnapshotsTable.key, PRIMARY_STORE_KEY))
    .limit(1);

  if (rows.length === 0) {
    return cloneDefaultStore();
  }

  const row = rows[0];
  const payload = isObjectRecord(row.payload) ? row.payload : {};
  return normalizeStore({
    ...(payload as Partial<PlatformStoreData>),
    version: row.version,
  });
}

async function persistPlatformStoreToDatabase(data: PlatformStoreData): Promise<void> {
  const db = getDatabaseClient();
  await ensurePlatformStoreSnapshotTable();

  await db
    .insert(platformStoreSnapshotsTable)
    .values({
      key: PRIMARY_STORE_KEY,
      version: data.version,
      payload: data as unknown as Record<string, unknown>,
      updatedAt: getNowTimestamp(),
    })
    .onConflictDoUpdate({
      target: platformStoreSnapshotsTable.key,
      set: {
        version: data.version,
        payload: data as unknown as Record<string, unknown>,
        updatedAt: getNowTimestamp(),
      },
    });

  cachedDatabaseStore = data;
  cachedDatabaseStoreLoadedAt = Date.now();
}

function cloneDefaultStore(): PlatformStoreData {
  return {
    ...DEFAULT_DATA,
    users: [],
    organizations: [],
    workspaces: [],
    projects: [],
    sourceDocuments: [],
    generationJobs: [],
    generationArtifacts: [],
    artifactRelations: [],
    usageEvents: [],
    subscriptions: [],
    paymentOrders: [],
    creditAccounts: [],
    creditLedgerEntries: [],
    redeemCodeCampaigns: [],
    redeemCodes: [],
    redeemCodeRedemptions: [],
  };
}

function normalizeStore(raw: Partial<PlatformStoreData>): PlatformStoreData {
  return {
    version: typeof raw.version === 'number' ? raw.version : STORE_VERSION,
    users: raw.users ?? [],
    organizations: raw.organizations ?? [],
    workspaces: raw.workspaces ?? [],
    projects: raw.projects ?? [],
    sourceDocuments: raw.sourceDocuments ?? [],
    generationJobs: raw.generationJobs ?? [],
    generationArtifacts: raw.generationArtifacts ?? [],
    artifactRelations: raw.artifactRelations ?? [],
    usageEvents: raw.usageEvents ?? [],
    subscriptions: raw.subscriptions ?? [],
    paymentOrders: raw.paymentOrders ?? [],
    creditAccounts: raw.creditAccounts ?? [],
    creditLedgerEntries: raw.creditLedgerEntries ?? [],
    redeemCodeCampaigns: raw.redeemCodeCampaigns ?? [],
    redeemCodes: raw.redeemCodes ?? [],
    redeemCodeRedemptions: raw.redeemCodeRedemptions ?? [],
  };
}

async function ensurePlatformStoreSnapshotTable(): Promise<void> {
  const db = getDatabaseClient();
  await db.execute(sql`
    create table if not exists "platform_store_snapshots" (
      "key" text primary key,
      "version" integer not null,
      "payload" jsonb not null,
      "updatedAt" timestamptz not null
    )
  `);

  await db
    .insert(platformStoreSnapshotsTable)
    .values({
      key: PRIMARY_STORE_KEY,
      version: DEFAULT_DATA.version,
      payload: DEFAULT_DATA as unknown as Record<string, unknown>,
      updatedAt: getNowTimestamp(),
    })
    .onConflictDoNothing({
      target: platformStoreSnapshotsTable.key,
    });
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

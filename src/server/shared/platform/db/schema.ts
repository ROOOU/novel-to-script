import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  ArtifactRelation,
  CreditAccount,
  CreditLedgerEntry,
  GenerationArtifact,
  GenerationJob,
  Organization,
  PaymentOrder,
  PlanEntitlements,
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

const timestampOptions = { withTimezone: true as const, mode: 'string' as const };

function auditColumns() {
  return {
    createdAt: timestamp('createdAt', timestampOptions).notNull(),
    createdByUserId: text('createdByUserId'),
    updatedAt: timestamp('updatedAt', timestampOptions).notNull(),
    updatedByUserId: text('updatedByUserId'),
  };
}

function dataColumn<T>() {
  return jsonb('data').$type<T>().notNull();
}

export const usersTable = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('displayName').notNull(),
    passwordHash: text('passwordHash'),
    avatarUrl: text('avatarUrl'),
    preferredLocale: text('preferredLocale'),
    defaultOrganizationId: text('defaultOrganizationId'),
    status: text('status').notNull(),
    lastLoginAt: timestamp('lastLoginAt', timestampOptions),
    ...auditColumns(),
    data: dataColumn<User>(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    defaultOrganizationIdx: index('users_default_organization_idx').on(table.defaultOrganizationId),
  })
);

export const organizationsTable = pgTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    ownerUserId: text('ownerUserId').notNull(),
    status: text('status').notNull(),
    billingLocale: text('billingLocale').notNull(),
    billingCurrency: text('billingCurrency').notNull(),
    pricingRegion: text('pricingRegion').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ...auditColumns(),
    data: dataColumn<Organization>(),
  },
  (table) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
    ownerIdx: index('organizations_owner_idx').on(table.ownerUserId),
  })
);

export const workspacesTable = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    defaultLocale: text('defaultLocale'),
    defaultModelName: text('defaultModelName'),
    ...auditColumns(),
    data: dataColumn<Workspace>(),
  },
  (table) => ({
    orgSlugIdx: uniqueIndex('workspaces_org_slug_idx').on(table.organizationId, table.slug),
    organizationIdx: index('workspaces_org_idx').on(table.organizationId),
  })
);

export const projectsTable = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    workspaceId: text('workspaceId').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    sourceDocumentId: text('sourceDocumentId'),
    latestGenerationJobId: text('latestGenerationJobId'),
    genre: text('genre'),
    labels: jsonb('labels').$type<string[] | null>(),
    archivedAt: timestamp('archivedAt', timestampOptions),
    ...auditColumns(),
    data: dataColumn<Project>(),
  },
  (table) => ({
    workspaceSlugIdx: uniqueIndex('projects_workspace_slug_idx').on(table.workspaceId, table.slug),
    organizationIdx: index('projects_organization_idx').on(table.organizationId),
    workspaceIdx: index('projects_workspace_idx').on(table.workspaceId),
    sourceDocumentIdx: index('projects_source_document_idx').on(table.sourceDocumentId),
  })
);

export const sourceDocumentsTable = pgTable(
  'source_documents',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    workspaceId: text('workspaceId').notNull(),
    projectId: text('projectId').notNull(),
    title: text('title').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    mimeType: text('mimeType').notNull(),
    textContent: text('textContent'),
    storageKey: text('storageKey'),
    checksum: text('checksum'),
    wordCount: integer('wordCount'),
    sourceVersion: text('sourceVersion'),
    ...auditColumns(),
    data: dataColumn<SourceDocument>(),
  },
  (table) => ({
    projectIdx: index('source_documents_project_idx').on(table.projectId),
    workspaceIdx: index('source_documents_workspace_idx').on(table.workspaceId),
  })
);

export const generationJobsTable = pgTable(
  'generation_jobs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    workspaceId: text('workspaceId').notNull(),
    projectId: text('projectId').notNull(),
    sourceDocumentId: text('sourceDocumentId'),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    billingState: text('billingState').notNull(),
    reservedCredits: integer('reservedCredits'),
    settledCredits: integer('settledCredits'),
    progress: integer('progress').notNull(),
    currentStep: text('currentStep'),
    requestedByUserId: text('requestedByUserId'),
    requestedBySessionId: text('requestedBySessionId'),
    modelName: text('modelName'),
    inputSnapshot: jsonb('inputSnapshot').$type<Record<string, unknown>>().notNull(),
    outputSummary: text('outputSummary'),
    errorMessage: text('errorMessage'),
    startedAt: timestamp('startedAt', timestampOptions),
    finishedAt: timestamp('finishedAt', timestampOptions),
    cancelledAt: timestamp('cancelledAt', timestampOptions),
    ...auditColumns(),
    data: dataColumn<GenerationJob>(),
  },
  (table) => ({
    projectIdx: index('generation_jobs_project_idx').on(table.projectId),
    workspaceIdx: index('generation_jobs_workspace_idx').on(table.workspaceId),
    statusIdx: index('generation_jobs_status_idx').on(table.status),
  })
);

export const generationArtifactsTable = pgTable(
  'generation_artifacts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    workspaceId: text('workspaceId').notNull(),
    projectId: text('projectId').notNull(),
    generationJobId: text('generationJobId').notNull(),
    sourceDocumentId: text('sourceDocumentId'),
    kind: text('kind').notNull(),
    format: text('format').notNull(),
    title: text('title').notNull(),
    version: integer('version').notNull(),
    content: text('content'),
    storageKey: text('storageKey'),
    checksum: text('checksum'),
    isEditable: boolean('isEditable').notNull(),
    parentArtifactId: text('parentArtifactId'),
    versionGroupId: text('versionGroupId'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ...auditColumns(),
    data: dataColumn<GenerationArtifact>(),
  },
  (table) => ({
    jobIdx: index('generation_artifacts_job_idx').on(table.generationJobId),
    projectIdx: index('generation_artifacts_project_idx').on(table.projectId),
    kindVersionIdx: index('generation_artifacts_kind_version_idx').on(table.projectId, table.kind, table.version),
    versionGroupIdx: index('generation_artifacts_version_group_idx').on(table.versionGroupId),
  })
);

export const usageEventsTable = pgTable(
  'usage_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    workspaceId: text('workspaceId'),
    projectId: text('projectId'),
    generationJobId: text('generationJobId'),
    userId: text('userId'),
    kind: text('kind').notNull(),
    featureKey: text('featureKey').notNull(),
    modelName: text('modelName'),
    inputTokens: integer('inputTokens'),
    outputTokens: integer('outputTokens'),
    costCents: integer('costCents'),
    quantity: integer('quantity'),
    occurredAt: timestamp('occurredAt', timestampOptions).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ...auditColumns(),
    data: dataColumn<UsageEvent>(),
  },
  (table) => ({
    organizationIdx: index('usage_events_organization_idx').on(table.organizationId),
    workspaceIdx: index('usage_events_workspace_idx').on(table.workspaceId),
    occurredIdx: index('usage_events_occurred_idx').on(table.occurredAt),
  })
);

export const subscriptionsTable = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    provider: text('provider').notNull(),
    providerCustomerId: text('providerCustomerId'),
    providerSubscriptionId: text('providerSubscriptionId'),
    providerPriceId: text('providerPriceId'),
    planKey: text('planKey').notNull(),
    status: text('status').notNull(),
    billingInterval: text('billingInterval').notNull(),
    currentPeriodStart: timestamp('currentPeriodStart', timestampOptions),
    currentPeriodEnd: timestamp('currentPeriodEnd', timestampOptions),
    seatsIncluded: integer('seatsIncluded'),
    seatCount: integer('seatCount'),
    entitlements: jsonb('entitlements').$type<PlanEntitlements>().notNull(),
    priceCents: integer('priceCents'),
    currency: text('currency'),
    trialEndsAt: timestamp('trialEndsAt', timestampOptions),
    canceledAt: timestamp('canceledAt', timestampOptions),
    ...auditColumns(),
    data: dataColumn<Subscription>(),
  },
  (table) => ({
    organizationIdx: uniqueIndex('subscriptions_organization_idx').on(table.organizationId),
    providerSubscriptionIdx: index('subscriptions_provider_subscription_idx').on(table.providerSubscriptionId),
  })
);

export const paymentOrdersTable = pgTable(
  'payment_orders',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    subscriptionId: text('subscriptionId'),
    provider: text('provider').notNull(),
    purchaseKind: text('purchaseKind').notNull(),
    status: text('status').notNull(),
    planKey: text('planKey'),
    creditPackKey: text('creditPackKey'),
    amountCents: integer('amountCents').notNull(),
    currency: text('currency').notNull(),
    creditsGranted: integer('creditsGranted'),
    providerOrderId: text('providerOrderId'),
    providerCustomerId: text('providerCustomerId'),
    providerSubscriptionId: text('providerSubscriptionId'),
    paidAt: timestamp('paidAt', timestampOptions),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ...auditColumns(),
    data: dataColumn<PaymentOrder>(),
  },
  (table) => ({
    organizationIdx: index('payment_orders_organization_idx').on(table.organizationId),
    providerOrderIdx: uniqueIndex('payment_orders_provider_order_idx').on(table.providerOrderId),
  })
);

export const artifactRelationsTable = pgTable(
  'artifact_relations',
  {
    id: text('id').primaryKey(),
    projectId: text('projectId').notNull(),
    upstreamArtifactId: text('upstreamArtifactId').notNull(),
    downstreamArtifactId: text('downstreamArtifactId').notNull(),
    relationType: text('relationType').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ...auditColumns(),
    data: dataColumn<ArtifactRelation>(),
  },
  (table) => ({
    projectIdx: index('artifact_relations_project_idx').on(table.projectId),
    downstreamIdx: index('artifact_relations_downstream_idx').on(table.downstreamArtifactId),
  })
);

export const creditAccountsTable = pgTable(
  'credit_accounts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    availableCredits: integer('availableCredits').notNull(),
    reservedCredits: integer('reservedCredits').notNull(),
    grantedCreditsTotal: integer('grantedCreditsTotal').notNull(),
    consumedCreditsTotal: integer('consumedCreditsTotal').notNull(),
    ...auditColumns(),
    data: dataColumn<CreditAccount>(),
  },
  (table) => ({
    organizationIdx: uniqueIndex('credit_accounts_organization_idx').on(table.organizationId),
  })
);

export const creditLedgerEntriesTable = pgTable(
  'credit_ledger_entries',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    creditAccountId: text('creditAccountId').notNull(),
    kind: text('kind').notNull(),
    deltaCredits: integer('deltaCredits').notNull(),
    balanceAfter: integer('balanceAfter').notNull(),
    paymentOrderId: text('paymentOrderId'),
    generationJobId: text('generationJobId'),
    redeemCodeId: text('redeemCodeId'),
    note: text('note'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ...auditColumns(),
    data: dataColumn<CreditLedgerEntry>(),
  },
  (table) => ({
    organizationIdx: index('credit_ledger_entries_organization_idx').on(table.organizationId),
    generationJobIdx: index('credit_ledger_entries_generation_job_idx').on(table.generationJobId),
  })
);

export const redeemCodeCampaignsTable = pgTable(
  'redeem_code_campaigns',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId'),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    creditsGranted: integer('creditsGranted').notNull(),
    codePrefix: text('codePrefix'),
    totalLimit: integer('totalLimit'),
    perOrganizationLimit: integer('perOrganizationLimit'),
    startsAt: timestamp('startsAt', timestampOptions),
    endsAt: timestamp('endsAt', timestampOptions),
    eligiblePlanKeys: jsonb('eligiblePlanKeys').$type<string[] | null>(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ...auditColumns(),
    data: dataColumn<RedeemCodeCampaign>(),
  },
  (table) => ({
    organizationIdx: index('redeem_code_campaigns_organization_idx').on(table.organizationId),
  })
);

export const redeemCodesTable = pgTable(
  'redeem_codes',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaignId').notNull(),
    code: text('code').notNull(),
    status: text('status').notNull(),
    creditsGranted: integer('creditsGranted').notNull(),
    maxRedemptions: integer('maxRedemptions').notNull(),
    redeemedCount: integer('redeemedCount').notNull(),
    expiresAt: timestamp('expiresAt', timestampOptions),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ...auditColumns(),
    data: dataColumn<RedeemCode>(),
  },
  (table) => ({
    codeIdx: uniqueIndex('redeem_codes_code_idx').on(table.code),
    campaignIdx: index('redeem_codes_campaign_idx').on(table.campaignId),
  })
);

export const redeemCodeRedemptionsTable = pgTable(
  'redeem_code_redemptions',
  {
    id: text('id').primaryKey(),
    redeemCodeId: text('redeemCodeId').notNull(),
    campaignId: text('campaignId').notNull(),
    organizationId: text('organizationId').notNull(),
    userId: text('userId').notNull(),
    creditLedgerEntryId: text('creditLedgerEntryId').notNull(),
    redeemedAt: timestamp('redeemedAt', timestampOptions).notNull(),
    ...auditColumns(),
    data: dataColumn<RedeemCodeRedemption>(),
  },
  (table) => ({
    organizationIdx: index('redeem_code_redemptions_organization_idx').on(table.organizationId),
    redeemCodeIdx: index('redeem_code_redemptions_code_idx').on(table.redeemCodeId),
  })
);

export const platformStoreSnapshotsTable = pgTable('platform_store_snapshots', {
  key: text('key').primaryKey(),
  version: integer('version').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updatedAt', timestampOptions).notNull(),
});

export const platformSchema = {
  users: usersTable,
  organizations: organizationsTable,
  workspaces: workspacesTable,
  projects: projectsTable,
  sourceDocuments: sourceDocumentsTable,
  generationJobs: generationJobsTable,
  generationArtifacts: generationArtifactsTable,
  artifactRelations: artifactRelationsTable,
  usageEvents: usageEventsTable,
  subscriptions: subscriptionsTable,
  paymentOrders: paymentOrdersTable,
  creditAccounts: creditAccountsTable,
  creditLedgerEntries: creditLedgerEntriesTable,
  redeemCodeCampaigns: redeemCodeCampaignsTable,
  redeemCodes: redeemCodesTable,
  redeemCodeRedemptions: redeemCodeRedemptionsTable,
  platformStoreSnapshots: platformStoreSnapshotsTable,
} as const;

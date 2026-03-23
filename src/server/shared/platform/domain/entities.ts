/**
 * Shared platform domain primitives for the SaaS version of NovelScript.
 * These types stay storage-agnostic so runtime implementations can target
 * PostgreSQL, Redis-backed queues, or local persistent stores.
 */

export type EntityId = string;
export type Timestamp = string;
export type Slug = string;

export type SupportedLocale = 'zh-CN' | 'en-US';
export type SupportedCurrency = 'USD';
export type PricingRegion = 'global';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type UserStatus = 'active' | 'invited' | 'suspended' | 'deleted';
export type OrganizationStatus = 'active' | 'archived';
export type WorkspaceStatus = 'active' | 'archived';
export type ProjectStatus = 'draft' | 'active' | 'archived';
export type SourceDocumentStatus = 'draft' | 'ready' | 'archived';
export type SourceDocumentKind =
  | 'novel'
  | 'script'
  | 'outline'
  | 'storyboard'
  | 'reference'
  | 'export';
export type GenerationJobKind =
  | 'script-generation'
  | 'storyboard-generation'
  | 'export-generation'
  | 'analysis-generation';
export type GenerationJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type GenerationJobBillingState =
  | 'none'
  | 'reserved'
  | 'captured'
  | 'released';
export type GenerationArtifactKind =
  | 'analysis'
  | 'outline'
  | 'script'
  | 'storyboard'
  | 'export'
  | 'prompt';
export type GenerationArtifactFormat =
  | 'text/plain'
  | 'application/json'
  | 'text/markdown'
  | 'application/pdf'
  | 'application/zip'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export type UsageEventKind =
  | 'llm_request'
  | 'generation_job'
  | 'export'
  | 'storage'
  | 'api_request'
  | 'billing'
  | 'credit';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';
export type BillingInterval = 'monthly' | 'annual';
export type SubscriptionProvider = 'paypal' | 'internal';
export type BillingProvider = 'paypal' | 'internal';
export type PurchaseKind = 'subscription' | 'credit-pack';
export type ArtifactRelationType = 'derived_from';
export type PaymentOrderStatus =
  | 'draft'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded';
export type CreditLedgerEntryKind =
  | 'subscription_grant'
  | 'pack_purchase'
  | 'redeem_code_grant'
  | 'manual_adjustment'
  | 'job_reserve'
  | 'job_capture'
  | 'job_release'
  | 'refund_adjustment';
export type RedeemCodeCampaignStatus = 'draft' | 'active' | 'expired' | 'archived';
export type RedeemCodeStatus = 'active' | 'disabled' | 'expired' | 'archived';

export interface AuditFields {
  createdAt: Timestamp;
  createdByUserId?: EntityId | null;
  updatedAt: Timestamp;
  updatedByUserId?: EntityId | null;
}

export interface User extends AuditFields {
  id: EntityId;
  email: string;
  displayName: string;
  passwordHash?: string | null;
  avatarUrl?: string | null;
  preferredLocale?: SupportedLocale;
  defaultOrganizationId?: EntityId | null;
  status: UserStatus;
  lastLoginAt?: Timestamp | null;
}

export interface Organization extends AuditFields {
  id: EntityId;
  slug: Slug;
  name: string;
  ownerUserId: EntityId;
  status: OrganizationStatus;
  billingLocale: SupportedLocale;
  billingCurrency: SupportedCurrency;
  pricingRegion: PricingRegion;
  metadata?: Record<string, unknown>;
}

export interface Workspace extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  slug: Slug;
  name: string;
  description?: string | null;
  status: WorkspaceStatus;
  defaultLocale?: SupportedLocale;
  defaultModelName?: string | null;
}

export interface Project extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  workspaceId: EntityId;
  slug: Slug;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  sourceDocumentId?: EntityId | null;
  latestGenerationJobId?: EntityId | null;
  genre?: string | null;
  labels?: string[];
  archivedAt?: Timestamp | null;
}

export interface SourceDocument extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  workspaceId: EntityId;
  projectId: EntityId;
  title: string;
  kind: SourceDocumentKind;
  status: SourceDocumentStatus;
  mimeType: string;
  textContent?: string | null;
  storageKey?: string | null;
  checksum?: string | null;
  wordCount?: number | null;
  sourceVersion?: string | null;
}

export interface GenerationJob extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  workspaceId: EntityId;
  projectId: EntityId;
  sourceDocumentId?: EntityId | null;
  kind: GenerationJobKind;
  status: GenerationJobStatus;
  billingState: GenerationJobBillingState;
  reservedCredits?: number | null;
  settledCredits?: number | null;
  progress: number;
  currentStep?: string | null;
  requestedByUserId?: EntityId | null;
  requestedBySessionId?: EntityId | null;
  modelName?: string | null;
  inputSnapshot: Record<string, unknown>;
  outputSummary?: string | null;
  errorMessage?: string | null;
  startedAt?: Timestamp | null;
  finishedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
}

export interface GenerationArtifact extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  workspaceId: EntityId;
  projectId: EntityId;
  generationJobId: EntityId;
  sourceDocumentId?: EntityId | null;
  kind: GenerationArtifactKind;
  format: GenerationArtifactFormat;
  title: string;
  version: number;
  content?: string | null;
  storageKey?: string | null;
  checksum?: string | null;
  isEditable?: boolean;
  parentArtifactId?: EntityId | null;
  versionGroupId?: EntityId | null;
  metadata?: Record<string, unknown>;
}

export interface ArtifactRelation extends AuditFields {
  id: EntityId;
  projectId: EntityId;
  upstreamArtifactId: EntityId;
  downstreamArtifactId: EntityId;
  relationType: ArtifactRelationType;
  metadata?: Record<string, unknown>;
}

export interface UsageEvent extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  workspaceId?: EntityId | null;
  projectId?: EntityId | null;
  generationJobId?: EntityId | null;
  userId?: EntityId | null;
  kind: UsageEventKind;
  featureKey: string;
  modelName?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costCents?: number | null;
  quantity?: number | null;
  occurredAt: Timestamp;
  metadata?: Record<string, unknown>;
}

export interface PlanEntitlements {
  maxProjects?: number | null;
  maxWorkspaces?: number | null;
  maxMembers?: number | null;
  maxConcurrentJobs?: number | null;
  monthlyCredits?: number | null;
  monthlyTokenQuota?: number | null;
  monthlyUsageQuotaCents?: number | null;
  canUseBranding?: boolean;
  canUseApiAccess?: boolean;
  canUsePrivateDeployment?: boolean;
  canUseTeamCollaboration?: boolean;
}

export interface Subscription extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  provider: SubscriptionProvider;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerPriceId?: string | null;
  planKey: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart?: Timestamp | null;
  currentPeriodEnd?: Timestamp | null;
  seatsIncluded?: number | null;
  seatCount?: number | null;
  entitlements: PlanEntitlements;
  priceCents?: number | null;
  currency?: SupportedCurrency | null;
  trialEndsAt?: Timestamp | null;
  canceledAt?: Timestamp | null;
}

export interface PaymentOrder extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  subscriptionId?: EntityId | null;
  provider: BillingProvider;
  purchaseKind: PurchaseKind;
  status: PaymentOrderStatus;
  planKey?: string | null;
  creditPackKey?: string | null;
  amountCents: number;
  currency: SupportedCurrency;
  creditsGranted?: number | null;
  providerOrderId?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  paidAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
}

export interface CreditAccount extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  availableCredits: number;
  reservedCredits: number;
  grantedCreditsTotal: number;
  consumedCreditsTotal: number;
}

export interface CreditLedgerEntry extends AuditFields {
  id: EntityId;
  organizationId: EntityId;
  creditAccountId: EntityId;
  kind: CreditLedgerEntryKind;
  deltaCredits: number;
  balanceAfter: number;
  paymentOrderId?: EntityId | null;
  generationJobId?: EntityId | null;
  redeemCodeId?: EntityId | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RedeemCodeCampaign extends AuditFields {
  id: EntityId;
  organizationId?: EntityId | null;
  name: string;
  description?: string | null;
  status: RedeemCodeCampaignStatus;
  creditsGranted: number;
  codePrefix?: string | null;
  totalLimit?: number | null;
  perOrganizationLimit?: number | null;
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  eligiblePlanKeys?: string[] | null;
}

export interface RedeemCode extends AuditFields {
  id: EntityId;
  campaignId: EntityId;
  code: string;
  status: RedeemCodeStatus;
  creditsGranted: number;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
}

export interface RedeemCodeRedemption extends AuditFields {
  id: EntityId;
  redeemCodeId: EntityId;
  campaignId: EntityId;
  organizationId: EntityId;
  userId: EntityId;
  creditLedgerEntryId: EntityId;
  redeemedAt: Timestamp;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  passwordHash?: string | null;
  avatarUrl?: string | null;
  preferredLocale?: SupportedLocale;
  defaultOrganizationId?: EntityId | null;
  status?: UserStatus;
  createdByUserId?: EntityId | null;
}

export interface UpdateUserInput {
  displayName?: string;
  passwordHash?: string | null;
  avatarUrl?: string | null;
  preferredLocale?: SupportedLocale;
  defaultOrganizationId?: EntityId | null;
  status?: UserStatus;
  lastLoginAt?: Timestamp | null;
  updatedByUserId?: EntityId | null;
}

export interface CreateOrganizationInput {
  slug: Slug;
  name: string;
  ownerUserId: EntityId;
  billingLocale: SupportedLocale;
  billingCurrency: SupportedCurrency;
  pricingRegion: PricingRegion;
  metadata?: Record<string, unknown>;
  createdByUserId?: EntityId | null;
}

export interface UpdateOrganizationInput {
  name?: string;
  status?: OrganizationStatus;
  billingLocale?: SupportedLocale;
  billingCurrency?: SupportedCurrency;
  pricingRegion?: PricingRegion;
  metadata?: Record<string, unknown>;
  updatedByUserId?: EntityId | null;
}

export interface CreateWorkspaceInput {
  organizationId: EntityId;
  slug: Slug;
  name: string;
  description?: string | null;
  defaultLocale?: SupportedLocale;
  defaultModelName?: string | null;
  createdByUserId?: EntityId | null;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string | null;
  status?: WorkspaceStatus;
  defaultLocale?: SupportedLocale;
  defaultModelName?: string | null;
  updatedByUserId?: EntityId | null;
}

export interface CreateProjectInput {
  organizationId: EntityId;
  workspaceId: EntityId;
  slug: Slug;
  name: string;
  description?: string | null;
  sourceDocumentId?: EntityId | null;
  genre?: string | null;
  labels?: string[];
  createdByUserId?: EntityId | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  sourceDocumentId?: EntityId | null;
  latestGenerationJobId?: EntityId | null;
  genre?: string | null;
  labels?: string[];
  archivedAt?: Timestamp | null;
  updatedByUserId?: EntityId | null;
}

export interface CreateSourceDocumentInput {
  organizationId: EntityId;
  workspaceId: EntityId;
  projectId: EntityId;
  title: string;
  kind: SourceDocumentKind;
  mimeType: string;
  textContent?: string | null;
  storageKey?: string | null;
  checksum?: string | null;
  wordCount?: number | null;
  sourceVersion?: string | null;
  createdByUserId?: EntityId | null;
}

export interface UpdateSourceDocumentInput {
  title?: string;
  kind?: SourceDocumentKind;
  status?: SourceDocumentStatus;
  textContent?: string | null;
  storageKey?: string | null;
  checksum?: string | null;
  wordCount?: number | null;
  sourceVersion?: string | null;
  updatedByUserId?: EntityId | null;
}

export interface CreateGenerationJobInput {
  organizationId: EntityId;
  workspaceId: EntityId;
  projectId: EntityId;
  sourceDocumentId?: EntityId | null;
  kind: GenerationJobKind;
  requestedByUserId?: EntityId | null;
  requestedBySessionId?: EntityId | null;
  modelName?: string | null;
  inputSnapshot: Record<string, unknown>;
  billingState?: GenerationJobBillingState;
  reservedCredits?: number | null;
  settledCredits?: number | null;
}

export interface UpdateGenerationJobInput {
  status?: GenerationJobStatus;
  billingState?: GenerationJobBillingState;
  reservedCredits?: number | null;
  settledCredits?: number | null;
  progress?: number;
  currentStep?: string | null;
  outputSummary?: string | null;
  errorMessage?: string | null;
  startedAt?: Timestamp | null;
  finishedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
  modelName?: string | null;
  updatedByUserId?: EntityId | null;
}

export interface CreateGenerationArtifactInput {
  organizationId: EntityId;
  workspaceId: EntityId;
  projectId: EntityId;
  generationJobId: EntityId;
  sourceDocumentId?: EntityId | null;
  kind: GenerationArtifactKind;
  format: GenerationArtifactFormat;
  title: string;
  version?: number;
  content?: string | null;
  storageKey?: string | null;
  checksum?: string | null;
  isEditable?: boolean;
  parentArtifactId?: EntityId | null;
  versionGroupId?: EntityId | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: EntityId | null;
}

export interface UpdateGenerationArtifactInput {
  title?: string;
  content?: string | null;
  storageKey?: string | null;
  checksum?: string | null;
  isEditable?: boolean;
  parentArtifactId?: EntityId | null;
  versionGroupId?: EntityId | null;
  metadata?: Record<string, unknown>;
  updatedByUserId?: EntityId | null;
}

export interface CreateArtifactRelationInput {
  projectId: EntityId;
  upstreamArtifactId: EntityId;
  downstreamArtifactId: EntityId;
  relationType?: ArtifactRelationType;
  metadata?: Record<string, unknown>;
  createdByUserId?: EntityId | null;
}

export interface CreateUsageEventInput {
  organizationId: EntityId;
  workspaceId?: EntityId | null;
  projectId?: EntityId | null;
  generationJobId?: EntityId | null;
  userId?: EntityId | null;
  kind: UsageEventKind;
  featureKey: string;
  modelName?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costCents?: number | null;
  quantity?: number | null;
  occurredAt?: Timestamp;
  metadata?: Record<string, unknown>;
  createdByUserId?: EntityId | null;
}

export interface CreateSubscriptionInput {
  organizationId: EntityId;
  provider: SubscriptionProvider;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerPriceId?: string | null;
  planKey: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart?: Timestamp | null;
  currentPeriodEnd?: Timestamp | null;
  seatsIncluded?: number | null;
  seatCount?: number | null;
  entitlements: PlanEntitlements;
  priceCents?: number | null;
  currency?: SupportedCurrency | null;
  trialEndsAt?: Timestamp | null;
  canceledAt?: Timestamp | null;
  createdByUserId?: EntityId | null;
}

export interface UpdateSubscriptionInput {
  provider?: SubscriptionProvider;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerPriceId?: string | null;
  planKey?: string;
  status?: SubscriptionStatus;
  billingInterval?: BillingInterval;
  currentPeriodStart?: Timestamp | null;
  currentPeriodEnd?: Timestamp | null;
  seatsIncluded?: number | null;
  seatCount?: number | null;
  entitlements?: PlanEntitlements;
  priceCents?: number | null;
  currency?: SupportedCurrency | null;
  trialEndsAt?: Timestamp | null;
  canceledAt?: Timestamp | null;
  updatedByUserId?: EntityId | null;
}

export interface CreatePaymentOrderInput {
  organizationId: EntityId;
  subscriptionId?: EntityId | null;
  provider: BillingProvider;
  purchaseKind: PurchaseKind;
  status?: PaymentOrderStatus;
  planKey?: string | null;
  creditPackKey?: string | null;
  amountCents: number;
  currency: SupportedCurrency;
  creditsGranted?: number | null;
  providerOrderId?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  paidAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: EntityId | null;
}

export interface UpdatePaymentOrderInput {
  subscriptionId?: EntityId | null;
  status?: PaymentOrderStatus;
  planKey?: string | null;
  creditPackKey?: string | null;
  amountCents?: number;
  currency?: SupportedCurrency;
  creditsGranted?: number | null;
  providerOrderId?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  paidAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
  updatedByUserId?: EntityId | null;
}

export interface CreateCreditAccountInput {
  organizationId: EntityId;
  availableCredits?: number;
  reservedCredits?: number;
  grantedCreditsTotal?: number;
  consumedCreditsTotal?: number;
  createdByUserId?: EntityId | null;
}

export interface UpdateCreditAccountInput {
  availableCredits?: number;
  reservedCredits?: number;
  grantedCreditsTotal?: number;
  consumedCreditsTotal?: number;
  updatedByUserId?: EntityId | null;
}

export interface CreateCreditLedgerEntryInput {
  organizationId: EntityId;
  creditAccountId: EntityId;
  kind: CreditLedgerEntryKind;
  deltaCredits: number;
  balanceAfter: number;
  paymentOrderId?: EntityId | null;
  generationJobId?: EntityId | null;
  redeemCodeId?: EntityId | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: EntityId | null;
}

export interface CreateRedeemCodeCampaignInput {
  organizationId?: EntityId | null;
  name: string;
  description?: string | null;
  status?: RedeemCodeCampaignStatus;
  creditsGranted: number;
  codePrefix?: string | null;
  totalLimit?: number | null;
  perOrganizationLimit?: number | null;
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  eligiblePlanKeys?: string[] | null;
  createdByUserId?: EntityId | null;
}

export interface UpdateRedeemCodeCampaignInput {
  name?: string;
  description?: string | null;
  status?: RedeemCodeCampaignStatus;
  creditsGranted?: number;
  codePrefix?: string | null;
  totalLimit?: number | null;
  perOrganizationLimit?: number | null;
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  eligiblePlanKeys?: string[] | null;
  updatedByUserId?: EntityId | null;
}

export interface CreateRedeemCodeInput {
  campaignId: EntityId;
  code: string;
  status?: RedeemCodeStatus;
  creditsGranted: number;
  maxRedemptions?: number;
  expiresAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: EntityId | null;
}

export interface UpdateRedeemCodeInput {
  status?: RedeemCodeStatus;
  creditsGranted?: number;
  maxRedemptions?: number;
  redeemedCount?: number;
  expiresAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
  updatedByUserId?: EntityId | null;
}

export interface CreateRedeemCodeRedemptionInput {
  redeemCodeId: EntityId;
  campaignId: EntityId;
  organizationId: EntityId;
  userId: EntityId;
  creditLedgerEntryId: EntityId;
  redeemedAt?: Timestamp;
  createdByUserId?: EntityId | null;
}

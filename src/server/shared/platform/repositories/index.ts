import type {
  ArtifactRelation,
  CreateArtifactRelationInput,
  CreateCreditAccountInput,
  CreateCreditLedgerEntryInput,
  CreateGenerationArtifactInput,
  CreateGenerationJobInput,
  CreateOrganizationInput,
  CreatePaymentOrderInput,
  CreateProjectInput,
  CreateRedeemCodeCampaignInput,
  CreateRedeemCodeInput,
  CreateRedeemCodeRedemptionInput,
  CreateSourceDocumentInput,
  CreateSubscriptionInput,
  CreateUsageEventInput,
  CreateUserInput,
  CreateWorkspaceInput,
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
  Timestamp,
  UpdateCreditAccountInput,
  UpdateGenerationArtifactInput,
  UpdateGenerationJobInput,
  UpdateOrganizationInput,
  UpdatePaymentOrderInput,
  UpdateProjectInput,
  UpdateRedeemCodeCampaignInput,
  UpdateRedeemCodeInput,
  UpdateSourceDocumentInput,
  UpdateSubscriptionInput,
  UpdateUserInput,
  UpdateWorkspaceInput,
  UsageEvent,
  User,
  Workspace,
} from '../domain';

export interface UserRepository {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  listByIds(ids: string[]): Promise<User[]>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User>;
}

export interface OrganizationRepository {
  getById(id: string): Promise<Organization | null>;
  getBySlug(slug: string): Promise<Organization | null>;
  listByOwnerUserId(userId: string): Promise<Organization[]>;
  create(input: CreateOrganizationInput): Promise<Organization>;
  update(id: string, input: UpdateOrganizationInput): Promise<Organization>;
}

export interface WorkspaceRepository {
  getById(id: string): Promise<Workspace | null>;
  getBySlug(organizationId: string, slug: string): Promise<Workspace | null>;
  listByOrganizationId(organizationId: string): Promise<Workspace[]>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  update(id: string, input: UpdateWorkspaceInput): Promise<Workspace>;
  archive(id: string, updatedByUserId?: string | null): Promise<Workspace>;
}

export interface ProjectRepository {
  getById(id: string): Promise<Project | null>;
  getBySlug(workspaceId: string, slug: string): Promise<Project | null>;
  listByWorkspaceId(workspaceId: string): Promise<Project[]>;
  listByOrganizationId(organizationId: string): Promise<Project[]>;
  findBySourceDocumentId(sourceDocumentId: string): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  archive(id: string, updatedByUserId?: string | null): Promise<Project>;
}

export interface SourceDocumentRepository {
  getById(id: string): Promise<SourceDocument | null>;
  listByProjectId(projectId: string): Promise<SourceDocument[]>;
  listByWorkspaceId(workspaceId: string): Promise<SourceDocument[]>;
  create(input: CreateSourceDocumentInput): Promise<SourceDocument>;
  update(id: string, input: UpdateSourceDocumentInput): Promise<SourceDocument>;
  archive(id: string, updatedByUserId?: string | null): Promise<SourceDocument>;
}

export interface GenerationJobRepository {
  getById(id: string): Promise<GenerationJob | null>;
  listByProjectId(projectId: string): Promise<GenerationJob[]>;
  listByWorkspaceId(workspaceId: string): Promise<GenerationJob[]>;
  listActiveByWorkspaceId(workspaceId: string): Promise<GenerationJob[]>;
  create(input: CreateGenerationJobInput): Promise<GenerationJob>;
  update(id: string, input: UpdateGenerationJobInput): Promise<GenerationJob>;
  markQueued(id: string, updatedByUserId?: string | null): Promise<GenerationJob>;
  markRunning(id: string, startedAt?: Timestamp, updatedByUserId?: string | null): Promise<GenerationJob>;
  markSucceeded(
    id: string,
    input: Pick<
      UpdateGenerationJobInput,
      'progress' | 'currentStep' | 'outputSummary' | 'finishedAt' | 'settledCredits' | 'billingState' | 'updatedByUserId'
    >
  ): Promise<GenerationJob>;
  markFailed(
    id: string,
    input: Pick<
      UpdateGenerationJobInput,
      'errorMessage' | 'finishedAt' | 'billingState' | 'updatedByUserId'
    >
  ): Promise<GenerationJob>;
  cancel(id: string, cancelledAt?: Timestamp, updatedByUserId?: string | null): Promise<GenerationJob>;
}

export interface GenerationArtifactRepository {
  getById(id: string): Promise<GenerationArtifact | null>;
  listByJobId(generationJobId: string): Promise<GenerationArtifact[]>;
  listByProjectId(projectId: string): Promise<GenerationArtifact[]>;
  getLatestByKind(projectId: string, kind: GenerationArtifact['kind']): Promise<GenerationArtifact | null>;
  create(input: CreateGenerationArtifactInput): Promise<GenerationArtifact>;
  update(id: string, input: UpdateGenerationArtifactInput): Promise<GenerationArtifact>;
  archive(id: string, updatedByUserId?: string | null): Promise<GenerationArtifact>;
}

export interface ArtifactRelationRepository {
  getById(id: string): Promise<ArtifactRelation | null>;
  create(input: CreateArtifactRelationInput): Promise<ArtifactRelation>;
  createMany(inputs: CreateArtifactRelationInput[]): Promise<ArtifactRelation[]>;
  listByProjectId(projectId: string): Promise<ArtifactRelation[]>;
  listByDownstreamArtifactId(downstreamArtifactId: string): Promise<ArtifactRelation[]>;
}

export interface UsageEventRepository {
  getById(id: string): Promise<UsageEvent | null>;
  listByOrganizationId(organizationId: string): Promise<UsageEvent[]>;
  listByWorkspaceId(workspaceId: string): Promise<UsageEvent[]>;
  append(input: CreateUsageEventInput): Promise<UsageEvent>;
  summarizeUsage(
    organizationId: string,
    from?: string,
    to?: string
  ): Promise<{
    organizationId: string;
    totalEvents: number;
    totalTokens: number;
    totalCostCents: number;
  }>;
}

export interface UpsertCurrentSubscriptionInput extends CreateSubscriptionInput {
  subscriptionId?: string | null;
}

export interface SubscriptionRepository {
  getById(id: string): Promise<Subscription | null>;
  getCurrentByOrganizationId(organizationId: string): Promise<Subscription | null>;
  listByOrganizationId(organizationId: string): Promise<Subscription[]>;
  create(input: CreateSubscriptionInput): Promise<Subscription>;
  update(id: string, input: UpdateSubscriptionInput): Promise<Subscription>;
  upsertCurrent(organizationId: string, input: UpsertCurrentSubscriptionInput): Promise<Subscription>;
}

export interface PaymentOrderRepository {
  getById(id: string): Promise<PaymentOrder | null>;
  getByProviderOrderId(providerOrderId: string): Promise<PaymentOrder | null>;
  listByOrganizationId(organizationId: string): Promise<PaymentOrder[]>;
  create(input: CreatePaymentOrderInput): Promise<PaymentOrder>;
  update(id: string, input: UpdatePaymentOrderInput): Promise<PaymentOrder>;
}

export interface CreditAccountRepository {
  getById(id: string): Promise<CreditAccount | null>;
  getByOrganizationId(organizationId: string): Promise<CreditAccount | null>;
  create(input: CreateCreditAccountInput): Promise<CreditAccount>;
  update(id: string, input: UpdateCreditAccountInput): Promise<CreditAccount>;
}

export interface CreditLedgerRepository {
  getById(id: string): Promise<CreditLedgerEntry | null>;
  listByOrganizationId(organizationId: string): Promise<CreditLedgerEntry[]>;
  listByGenerationJobId(generationJobId: string): Promise<CreditLedgerEntry[]>;
  append(input: CreateCreditLedgerEntryInput): Promise<CreditLedgerEntry>;
}

export interface RedeemCodeCampaignRepository {
  getById(id: string): Promise<RedeemCodeCampaign | null>;
  list(): Promise<RedeemCodeCampaign[]>;
  create(input: CreateRedeemCodeCampaignInput): Promise<RedeemCodeCampaign>;
  update(id: string, input: UpdateRedeemCodeCampaignInput): Promise<RedeemCodeCampaign>;
}

export interface RedeemCodeRepository {
  getById(id: string): Promise<RedeemCode | null>;
  getByCode(code: string): Promise<RedeemCode | null>;
  listByCampaignId(campaignId: string): Promise<RedeemCode[]>;
  create(input: CreateRedeemCodeInput): Promise<RedeemCode>;
  update(id: string, input: UpdateRedeemCodeInput): Promise<RedeemCode>;
}

export interface RedeemCodeRedemptionRepository {
  getById(id: string): Promise<RedeemCodeRedemption | null>;
  listByOrganizationId(organizationId: string): Promise<RedeemCodeRedemption[]>;
  listByRedeemCodeId(redeemCodeId: string): Promise<RedeemCodeRedemption[]>;
  create(input: CreateRedeemCodeRedemptionInput): Promise<RedeemCodeRedemption>;
}

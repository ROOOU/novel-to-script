import { grantCredits } from '@/server/billing/service';
import { createProject, getProjectBundle, saveProjectSource } from '@/server/projects/service';
import { createEntityId } from '@/server/shared/platform/runtime';
import { getPlatformRuntime } from '@/server/shared/platform';
import type { SupportedCurrency, SupportedLocale } from '@/server/shared/platform/domain';

export type DeveloperScenarioKey =
  | 'seed-demo-project'
  | 'grant-credits'
  | 'create-payment-order'
  | 'create-redeem-campaign';

export interface DeveloperScenarioViewer {
  user: {
    id: string;
    email: string;
  };
  organization: {
    id: string;
    billingCurrency: SupportedCurrency;
  };
  workspace: {
    id: string;
  };
  session: {
    locale: SupportedLocale;
  };
  creditAccount?: {
    availableCredits: number;
  } | null;
}

export async function getDeveloperChannelSummary(viewer: DeveloperScenarioViewer) {
  const runtime = getPlatformRuntime();
  const [projects, paymentOrders, campaigns, creditAccount] = await Promise.all([
    runtime.projects.listByOrganizationId(viewer.organization.id),
    runtime.paymentOrders.listByOrganizationId(viewer.organization.id),
    runtime.redeemCodeCampaigns.list(),
    runtime.creditAccounts.getByOrganizationId(viewer.organization.id),
  ]);

  return {
    scenarios: [
      'seed-demo-project',
      'grant-credits',
      'create-payment-order',
      'create-redeem-campaign',
    ] as DeveloperScenarioKey[],
    organizationId: viewer.organization.id,
    email: viewer.user.email,
    currentCredits: creditAccount?.availableCredits ?? 0,
    projectCount: projects.length,
    paymentOrderCount: paymentOrders.length,
    campaignCount: campaigns.filter(
      (campaign) => !campaign.organizationId || campaign.organizationId === viewer.organization.id
    ).length,
  };
}

export async function runDeveloperScenario(input: {
  viewer: DeveloperScenarioViewer;
  scenario: DeveloperScenarioKey;
}) {
  switch (input.scenario) {
    case 'grant-credits':
      return grantDeveloperCredits(input.viewer);
    case 'create-payment-order':
      return createDeveloperPaymentOrder(input.viewer);
    case 'create-redeem-campaign':
      return createDeveloperRedeemCampaign(input.viewer);
    case 'seed-demo-project':
    default:
      return seedDeveloperDemoProject(input.viewer);
  }
}

async function grantDeveloperCredits(viewer: DeveloperScenarioViewer) {
  const grant = await grantCredits({
    organizationId: viewer.organization.id,
    userId: viewer.user.id,
    credits: 180,
    kind: 'manual_adjustment',
    note: 'Developer sandbox credit grant',
  });

  return {
    scenario: 'grant-credits' as const,
    summary: `Granted 180 credits to ${viewer.organization.id}`,
    account: grant.account,
    ledgerEntry: grant.ledgerEntry,
  };
}

async function createDeveloperPaymentOrder(viewer: DeveloperScenarioViewer) {
  const runtime = getPlatformRuntime();
  const order = await runtime.paymentOrders.create({
    organizationId: viewer.organization.id,
    provider: viewer.organization.billingCurrency === 'USD' ? 'stripe' : 'manual',
    purchaseKind: 'credit-pack',
    status: 'pending',
    creditPackKey: 'credits-120',
    amountCents: viewer.organization.billingCurrency === 'USD' ? 1500 : 9900,
    currency: viewer.organization.billingCurrency,
    creditsGranted: 120,
    metadata: {
      developerScenario: true,
      createdFrom: 'dev-channel',
    },
    createdByUserId: viewer.user.id,
  });

  return {
    scenario: 'create-payment-order' as const,
    summary: `Created ${order.provider} payment order ${order.id}`,
    order,
  };
}

async function createDeveloperRedeemCampaign(viewer: DeveloperScenarioViewer) {
  const runtime = getPlatformRuntime();
  const campaign = await runtime.redeemCodeCampaigns.create({
    organizationId: viewer.organization.id,
    name: `Dev Campaign ${new Date().toISOString().slice(0, 10)}`,
    description: 'Developer sandbox redeem campaign',
    status: 'active',
    creditsGranted: 60,
    codePrefix: 'DEV',
    totalLimit: 10,
    perOrganizationLimit: 2,
    createdByUserId: viewer.user.id,
  });

  const codes = await Promise.all(
    Array.from({ length: 5 }, async () =>
      runtime.redeemCodes.create({
        campaignId: campaign.id,
        code: buildDeveloperRedeemCode('DEV'),
        creditsGranted: campaign.creditsGranted,
        maxRedemptions: 1,
        createdByUserId: viewer.user.id,
      })
    )
  );

  return {
    scenario: 'create-redeem-campaign' as const,
    summary: `Created campaign ${campaign.id} with ${codes.length} codes`,
    campaign,
    codes,
  };
}

async function seedDeveloperDemoProject(viewer: DeveloperScenarioViewer) {
  const runtime = getPlatformRuntime();
  const project = await createProject({
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    userId: viewer.user.id,
    name: `Developer Sandbox ${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}`,
    description: 'Seeded by the developer testing channel',
    genre: 'urban',
  });

  const sourceDocument = await saveProjectSource({
    projectId: project.id,
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    userId: viewer.user.id,
    title: `${project.name} Source`,
    textContent: SAMPLE_NOVEL_TEXT,
  });

  const job = await runtime.generationJobs.create({
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    projectId: project.id,
    sourceDocumentId: sourceDocument.id,
    kind: 'script-generation',
    requestedByUserId: viewer.user.id,
    inputSnapshot: {
      developerScenario: true,
    },
    billingState: 'none',
    reservedCredits: 0,
  });

  await runtime.generationJobs.markSucceeded(job.id, {
    progress: 100,
    currentStep: 'seeded',
    outputSummary: 'Developer sandbox artifacts seeded',
    billingState: 'none',
    updatedByUserId: viewer.user.id,
  });

  const analysisArtifact = await runtime.generationArtifacts.create({
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    projectId: project.id,
    generationJobId: job.id,
    sourceDocumentId: sourceDocument.id,
    kind: 'analysis',
    format: 'application/json',
    title: '小说分析',
    content: JSON.stringify(SAMPLE_ANALYSIS, null, 2),
    isEditable: true,
    createdByUserId: viewer.user.id,
  });

  await runtime.generationArtifacts.create({
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    projectId: project.id,
    generationJobId: job.id,
    sourceDocumentId: sourceDocument.id,
    kind: 'outline',
    format: 'application/json',
    title: '分集大纲',
    content: JSON.stringify(SAMPLE_OUTLINE, null, 2),
    isEditable: true,
    createdByUserId: viewer.user.id,
  });

  const firstScript = await runtime.generationArtifacts.create({
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    projectId: project.id,
    generationJobId: job.id,
    sourceDocumentId: sourceDocument.id,
    kind: 'script',
    format: 'text/plain',
    title: '第1集剧本',
    content: SAMPLE_SCRIPT_V1,
    isEditable: true,
    createdByUserId: viewer.user.id,
  });

  await runtime.generationArtifacts.create({
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    projectId: project.id,
    generationJobId: job.id,
    sourceDocumentId: sourceDocument.id,
    kind: 'script',
    format: 'text/plain',
    title: '第1集剧本',
    content: SAMPLE_SCRIPT_V2,
    isEditable: true,
    parentArtifactId: firstScript.id,
    versionGroupId: firstScript.versionGroupId ?? firstScript.id,
    createdByUserId: viewer.user.id,
  });

  const bundle = await getProjectBundle(project.id);

  return {
    scenario: 'seed-demo-project' as const,
    summary: `Seeded demo project ${project.name}`,
    project,
    sourceDocument,
    analysisArtifactId: analysisArtifact.id,
    insights: bundle?.insights ?? null,
  };
}

function buildDeveloperRedeemCode(prefix: string) {
  return `${prefix}-${createEntityId('code').slice(-8).toUpperCase()}`;
}

const SAMPLE_NOVEL_TEXT = [
  '林晚为了救父亲的工厂，被迫与前男友顾承砚再度合作。',
  '两人一个想守住旧城，一个想推进资本收购，表面合作，暗中角力。',
  '随着旧案重启和情感反噬，他们在利益与旧情之间不断试探。',
].join('\n');

const SAMPLE_ANALYSIS = {
  title: '旧城心跳',
  genre: 'urban' as const,
  characters: [
    {
      name: '林晚',
      description: '工厂继承人，外冷内热，行动果断。',
      personality: '克制、强硬、有责任感',
      speechStyle: '简洁直接',
      relationships: ['顾承砚: 前任兼商业对手'],
    },
    {
      name: '顾承砚',
      description: '投资人，表面冷静，实际执念很深。',
      personality: '理性、锋利、控制欲强',
      speechStyle: '压迫感强，话少',
      relationships: ['林晚: 前任兼收购目标负责人'],
    },
  ],
  plotSummary: '前任重逢叠加旧城收购案，商业博弈与情感回潮并行推进。',
  keyConflicts: ['旧城保留 vs 资本收购', '旧情未了 vs 商业立场对立'],
  climaxPoints: ['收购会当天旧案证据曝光', '林晚当众拒绝顾承砚的条件'],
  emotionalBeats: ['重逢试探', '利益拉扯', '旧伤揭开', '并肩对抗外敌'],
};

const SAMPLE_OUTLINE = [
  {
    episodeNumber: 1,
    title: '旧城重逢',
    summary: '林晚在工厂危机中再次见到顾承砚，双方在谈判桌上针锋相对。',
    keyEvents: ['工厂现金流告急', '顾承砚提出收购方案', '林晚拒绝让步'],
    hook: '顾承砚拿出一份与林父有关的旧案材料。',
  },
  {
    episodeNumber: 2,
    title: '证据回潮',
    summary: '林晚决定调查旧案，顾承砚暗中介入，二人关系重新失衡。',
    keyEvents: ['林晚追查旧档案', '顾承砚截住关键证人', '工厂员工开始动摇'],
    hook: '证人说出当年事故背后另有主使。',
  },
];

const SAMPLE_SCRIPT_V1 = [
  '【场景一】厂房外，夜。',
  '林晚站在空荡的门口，风把公告吹得猎猎作响。',
  '顾承砚下车，抬眼看她：“你知道自己现在没有谈判筹码。”',
  '林晚冷声：“那你就别来。”',
].join('\n');

const SAMPLE_SCRIPT_V2 = [
  '【场景一】旧厂房外，夜。',
  '林晚独自站在风口，远处霓虹映出她发红的眼眶。',
  '顾承砚下车，目光停在她身上两秒：“你现在最缺的，不是情绪，是时间。”',
  '林晚压住呼吸：“所以你是来救我，还是来收购我？”',
].join('\n');

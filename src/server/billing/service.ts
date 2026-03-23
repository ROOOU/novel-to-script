import { getPlatformRuntime } from '@/server/shared/platform';

export async function getOrCreateCreditAccount(organizationId: string, userId?: string | null) {
  const runtime = getPlatformRuntime();
  const existing = await runtime.creditAccounts.getByOrganizationId(organizationId);
  if (existing) {
    return existing;
  }

  return runtime.creditAccounts.create({
    organizationId,
    availableCredits: 0,
    reservedCredits: 0,
    grantedCreditsTotal: 0,
    consumedCreditsTotal: 0,
    createdByUserId: userId ?? null,
  });
}

export async function grantCredits(input: {
  organizationId: string;
  userId?: string | null;
  credits: number;
  kind: 'subscription_grant' | 'pack_purchase' | 'redeem_code_grant' | 'manual_adjustment' | 'refund_adjustment';
  note?: string;
  paymentOrderId?: string | null;
  redeemCodeId?: string | null;
}) {
  const runtime = getPlatformRuntime();
  const account = await getOrCreateCreditAccount(input.organizationId, input.userId);
  const nextAvailable = account.availableCredits + input.credits;
  const nextGrantedTotal = account.grantedCreditsTotal + Math.max(0, input.credits);

  const updatedAccount = await runtime.creditAccounts.update(account.id, {
    availableCredits: nextAvailable,
    grantedCreditsTotal: nextGrantedTotal,
    updatedByUserId: input.userId ?? null,
  });

  const ledgerEntry = await runtime.creditLedger.append({
    organizationId: input.organizationId,
    creditAccountId: updatedAccount.id,
    kind: input.kind,
    deltaCredits: input.credits,
    balanceAfter: updatedAccount.availableCredits,
    paymentOrderId: input.paymentOrderId ?? null,
    redeemCodeId: input.redeemCodeId ?? null,
    note: input.note ?? null,
    createdByUserId: input.userId ?? null,
  });

  return {
    account: updatedAccount,
    ledgerEntry,
  };
}

export async function reserveJobCredits(input: {
  organizationId: string;
  userId?: string | null;
  generationJobId: string;
  credits: number;
  note?: string;
}) {
  const runtime = getPlatformRuntime();
  const account = await getOrCreateCreditAccount(input.organizationId, input.userId);
  if (account.availableCredits < input.credits) {
    throw new Error('INSUFFICIENT_CREDITS');
  }

  const updatedAccount = await runtime.creditAccounts.update(account.id, {
    availableCredits: account.availableCredits - input.credits,
    reservedCredits: account.reservedCredits + input.credits,
    updatedByUserId: input.userId ?? null,
  });

  const ledgerEntry = await runtime.creditLedger.append({
    organizationId: input.organizationId,
    creditAccountId: updatedAccount.id,
    kind: 'job_reserve',
    deltaCredits: -input.credits,
    balanceAfter: updatedAccount.availableCredits,
    generationJobId: input.generationJobId,
    note: input.note ?? null,
    createdByUserId: input.userId ?? null,
  });

  return {
    account: updatedAccount,
    ledgerEntry,
  };
}

export async function captureJobCredits(input: {
  organizationId: string;
  userId?: string | null;
  generationJobId: string;
  credits: number;
  note?: string;
}) {
  const runtime = getPlatformRuntime();
  const account = await getOrCreateCreditAccount(input.organizationId, input.userId);
  const updatedAccount = await runtime.creditAccounts.update(account.id, {
    reservedCredits: Math.max(0, account.reservedCredits - input.credits),
    consumedCreditsTotal: account.consumedCreditsTotal + input.credits,
    updatedByUserId: input.userId ?? null,
  });

  const ledgerEntry = await runtime.creditLedger.append({
    organizationId: input.organizationId,
    creditAccountId: updatedAccount.id,
    kind: 'job_capture',
    deltaCredits: 0,
    balanceAfter: updatedAccount.availableCredits,
    generationJobId: input.generationJobId,
    note: input.note ?? null,
    createdByUserId: input.userId ?? null,
  });

  return {
    account: updatedAccount,
    ledgerEntry,
  };
}

export async function releaseJobCredits(input: {
  organizationId: string;
  userId?: string | null;
  generationJobId: string;
  credits: number;
  note?: string;
}) {
  const runtime = getPlatformRuntime();
  const account = await getOrCreateCreditAccount(input.organizationId, input.userId);
  const updatedAccount = await runtime.creditAccounts.update(account.id, {
    availableCredits: account.availableCredits + input.credits,
    reservedCredits: Math.max(0, account.reservedCredits - input.credits),
    updatedByUserId: input.userId ?? null,
  });

  const ledgerEntry = await runtime.creditLedger.append({
    organizationId: input.organizationId,
    creditAccountId: updatedAccount.id,
    kind: 'job_release',
    deltaCredits: input.credits,
    balanceAfter: updatedAccount.availableCredits,
    generationJobId: input.generationJobId,
    note: input.note ?? null,
    createdByUserId: input.userId ?? null,
  });

  return {
    account: updatedAccount,
    ledgerEntry,
  };
}

import type {
  PlatformUsageEvent,
  PlatformUsageSnapshot,
  PlatformEntitlementSet,
  UsageMeterUnit,
} from './types';

export interface UsageQuotaCheck {
  allowed: boolean;
  reason?: string;
  remaining?: number;
}

export interface UsageMeter {
  record(event: PlatformUsageEvent): Promise<void> | void;
  snapshot(workspaceId: string): Promise<PlatformUsageSnapshot | null> | PlatformUsageSnapshot | null;
}

export function createNoopUsageMeter(): UsageMeter {
  return {
    record() {
      return;
    },
    snapshot() {
      return null;
    },
  };
}

export interface UsageBudget {
  monthlyGenerations: number;
  concurrentJobs: number;
  inputCharacters: number;
}

export interface UsagePreflightOptions {
  snapshot: PlatformUsageSnapshot | null;
  pendingRequestCount?: number;
  pendingCharacterCount?: number;
  activeJobCount?: number;
}

export function getUsageBudgetFromEntitlements(
  entitlements: PlatformEntitlementSet
): UsageBudget {
  return {
    monthlyGenerations: entitlements.maxMonthlyGenerations,
    concurrentJobs: entitlements.maxConcurrentJobs,
    inputCharacters: entitlements.maxInputCharacters,
  };
}

export function evaluateUsagePreflight(
  budget: UsageBudget,
  {
    snapshot,
    pendingRequestCount = 0,
    pendingCharacterCount = 0,
    activeJobCount = 0,
  }: UsagePreflightOptions
): UsageQuotaCheck {
  const requests = (snapshot?.requests ?? 0) + pendingRequestCount;
  const requestAllowance = evaluateUsageAllowance(budget, 'request', requests);
  if (!requestAllowance.allowed) {
    return requestAllowance;
  }

  const characters = (snapshot?.characters ?? 0) + pendingCharacterCount;
  const characterAllowance = evaluateUsageAllowance(budget, 'character', characters);
  if (!characterAllowance.allowed) {
    return characterAllowance;
  }

  if (Number.isFinite(budget.concurrentJobs) && activeJobCount >= budget.concurrentJobs) {
    return {
      allowed: false,
      reason: 'concurrent jobs exceeds allowed quota',
      remaining: 0,
    };
  }

  return { allowed: true };
}

export function evaluateUsageAllowance(
  budget: UsageBudget,
  unit: UsageMeterUnit,
  amount: number
): UsageQuotaCheck {
  if (amount < 0) {
    return { allowed: false, reason: 'usage amount must be positive' };
  }

  switch (unit) {
    case 'request':
    case 'job':
      return allowWithinBudget(budget.monthlyGenerations, amount, 'monthly generations');
    case 'character':
      return allowWithinBudget(budget.inputCharacters, amount, 'input characters');
    case 'token':
      return { allowed: true };
    case 'export':
      return { allowed: true };
    default:
      return { allowed: false, reason: `unsupported usage unit: ${unit}` };
  }
}

export function summarizeUsageEvent(event: PlatformUsageEvent): string {
  return `${event.workspaceId}:${event.feature}:${event.unit}:${event.amount}`;
}

function allowWithinBudget(
  limit: number,
  amount: number,
  label: string
): UsageQuotaCheck {
  if (!Number.isFinite(limit)) {
    return { allowed: true };
  }

  if (amount > limit) {
    return {
      allowed: false,
      reason: `${label} exceeds allowed quota`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: limit - amount,
  };
}

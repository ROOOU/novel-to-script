import { describe, expect, it } from 'vitest';
import { getPlanEntitlements, getPlanHeaderDefault, normalizePlan } from '@/server/shared/platform';

describe('platform plan normalization', () => {
  it('accepts only free, creator, and pro plan headers', () => {
    expect(getPlanHeaderDefault({ headers: new Headers([['x-plan', 'free']]) })).toBe('free');
    expect(getPlanHeaderDefault({ headers: new Headers([['x-plan', 'creator']]) })).toBe('creator');
    expect(getPlanHeaderDefault({ headers: new Headers([['x-plan', 'pro']]) })).toBe('pro');
    expect(getPlanHeaderDefault({ headers: new Headers([['x-plan', 'team']]) })).toBeUndefined();
    expect(getPlanHeaderDefault({ headers: new Headers([['x-plan', 'enterprise']]) })).toBeUndefined();
  });

  it('normalizes legacy plan values back to free', () => {
    expect(normalizePlan('creator')).toBe('creator');
    expect(normalizePlan('pro')).toBe('pro');
    expect(normalizePlan('team')).toBe('free');
    expect(normalizePlan('enterprise')).toBe('free');
  });

  it('keeps creator and pro entitlements distinct', () => {
    const creator = getPlanEntitlements('creator');
    const pro = getPlanEntitlements('pro');

    expect(creator.maxProjectsPerWorkspace).toBe(15);
    expect(creator.maxConcurrentJobs).toBe(2);
    expect(creator.maxMonthlyGenerations).toBe(200);
    expect(pro.maxProjectsPerWorkspace).toBe(Number.POSITIVE_INFINITY);
    expect(pro.maxConcurrentJobs).toBe(3);
    expect(pro.maxMonthlyGenerations).toBe(600);
  });
});

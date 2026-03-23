import {
  type PlatformUsageEvent,
  type PlatformUsageSnapshot,
  type UsageMeter,
} from '@/server/shared/platform/policies';

const usageEvents: PlatformUsageEvent[] = [];

export function createInMemoryUsageMeter(): UsageMeter {
  return {
    record(event) {
      usageEvents.push({
        ...event,
        workspaceId: event.workspaceId ?? '__anonymous__',
      });
    },
    snapshot(workspaceId: string) {
      const normalizedWorkspaceId = workspaceId || '__anonymous__';
      const { periodStart, periodEnd } = getCurrentPeriodBounds();
      const events = usageEvents.filter((event) => {
        return (
          (event.workspaceId ?? '__anonymous__') === normalizedWorkspaceId &&
          isWithinPeriod(event, periodStart, periodEnd)
        );
      });

      if (events.length === 0) {
        return {
          workspaceId: normalizedWorkspaceId,
          periodStart,
          periodEnd,
          requests: 0,
          jobs: 0,
          tokens: 0,
          characters: 0,
          exports: 0,
        };
      }

      return events.reduce<PlatformUsageSnapshot>(
        (snapshot, event) => {
          switch (event.unit) {
            case 'request':
              snapshot.requests += event.amount;
              break;
            case 'job':
              snapshot.jobs += event.amount;
              break;
            case 'token':
              snapshot.tokens += event.amount;
              break;
            case 'character':
              snapshot.characters += event.amount;
              break;
            case 'export':
              snapshot.exports += event.amount;
              break;
            default:
              break;
          }

          return snapshot;
        },
        {
          workspaceId: normalizedWorkspaceId,
          periodStart,
          periodEnd,
          requests: 0,
          jobs: 0,
          tokens: 0,
          characters: 0,
          exports: 0,
        }
      );
    },
  };
}

export function resetInMemoryUsageMeter(): void {
  usageEvents.length = 0;
}

function getCurrentPeriodBounds() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { periodStart, periodEnd };
}

function isWithinPeriod(
  event: PlatformUsageEvent,
  periodStart: string,
  periodEnd: string
) {
  const occurredAt = String(event.metadata?.occurredAt ?? new Date().toISOString());
  return occurredAt >= periodStart && occurredAt < periodEnd;
}

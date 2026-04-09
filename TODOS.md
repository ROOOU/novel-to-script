# TODOs

## Auth migration burn-in dashboard

- What: Add migration-specific auth metrics, alerts, and a simple dashboard for Clerk sync, viewer resolution, and account-link conflicts.
- Why: The reviewed bridge plan now depends on a burn-in period before legacy auth deletion. Without observability, "burn-in" is just a feeling.
- Pros: Safer rollout, faster debugging, explicit go/no-go criteria for legacy cleanup.
- Cons: Some extra instrumentation and dashboard work before the cleanup phase.
- Context: The review found missing logs and counters for `AUTH_ACCOUNT_LINK_CONFLICT`, `VIEWER_CONTEXT_MISSING`, and Clerk-backed viewer sync failures. This is the main operational gap in the current plan.
- Depends on / blocked by: Depends on the new Clerk-backed viewer sync path existing.

## Account-link conflict recovery path

- What: Add an explicit recovery/admin flow for verified-email link conflicts during the Clerk migration.
- Why: The current plan correctly blocks unsafe auto-linking, but it does not yet define what the user or operator does next.
- Pros: Prevents support dead-ends and silent auth failures for legacy users.
- Cons: Adds one more scoped piece of migration work.
- Context: Duplicate-email and unverified-email scenarios are currently high-risk migration edges. The plan now treats them as first-class failure states rather than edge trivia.
- Depends on / blocked by: Depends on the Clerk identity sync and conflict detection path.

## Legacy auth cleanup after burn-in

- What: Remove password-first auth exports, signed-cookie parsing, and bridge-only compatibility code after production burn-in is clean.
- Why: The review changed this from same-wave deletion to deferred cleanup for rollback safety.
- Pros: Preserves reversibility during rollout, still gets to the cleaner end state.
- Cons: Temporary bridge code lives longer.
- Context: The repo still has many consumers of the current viewer/session contract. Cleanup should happen only after metrics and staged verification show the Clerk path is stable.
- Depends on / blocked by: Blocked by successful burn-in and auth migration dashboard signals.

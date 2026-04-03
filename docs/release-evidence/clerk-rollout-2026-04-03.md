# Clerk Rollout Evidence - 2026-04-03

Release branch:

- `codex/clerk-auth-migration`

PR:

- `https://github.com/ROOOU/novel-to-script/pull/1`

Release commit:

- `16bf6bf`

## 1. Engineering Health Gates

- [x] `npm run typecheck`
  - output: pass
- [x] `npm test`
  - output: `76 files passed, 224 tests passed`
- [x] `npm run build`
  - output: pass (dynamic routes rendered as expected; no build blocker)
- [ ] `npm run preflight:production`
  - output: failed in current local env as expected; missing production Clerk/DB/PayPal vars and `PAYPAL_MODE=live`
- [ ] CI links:
  - latest PR checks pending confirmation on `16bf6bf`

## 2. Session + Route Validation

- [ ] `GET /api/auth/session` (authenticated)
  - request id:
  - response snippet: blocked (requires production-like authenticated Clerk session)
- [ ] signed-out redirect checks
  - routes checked:
  - screenshot links: blocked (manual browser pass pending)
- [ ] signed-in no-loop checks
  - routes checked:
  - screenshot links: blocked (manual browser pass pending)
- [ ] generation route 401 checks (signed out)
  - `/api/generate` response: blocked (manual runtime request pending)
  - `/api/storyboard` response: blocked (manual runtime request pending)

## 3. Identity Continuity

- [ ] legacy user linked correctly
  - local user id:
  - org id:
  - continuity notes: blocked (requires real legacy account in production-like environment)
- [ ] new user bootstrap complete
  - local user id:
  - org id:
  - workspace id:
  - subscription id:
  - credit account id: blocked (requires real new account sign-in flow)

## 4. Billing + Webhook Validation

- [ ] credit-pack purchase
  - order id:
  - local organization id:
  - ledger/credit update: blocked (requires live/sandbox payment execution)
- [ ] subscription purchase
  - provider subscription id:
  - local subscription state: blocked (requires live/sandbox payment execution)
- [ ] webhook reconciliation
  - event ids:
  - verification status: blocked (requires webhook delivery in target environment)

## 5. Burn-In Monitoring Snapshot

- observation window:
- Google sign-in success rate:
- Email sign-in success rate:
- `/api/auth/session` 401 rate:
- `AUTH_ACCOUNT_LINK_CONFLICT` count:
- checkout completion rate delta:
- webhook failure count:
- support ticket notes:

## 6. Go/No-Go

- decision:
- decision: NO-GO for production cutover from this local validation pass alone
- approvers:
- timestamp: 2026-04-03 (Asia/Shanghai)
- follow-up actions:
  - run `npm run preflight:production` in production env context and capture pass output
  - execute manual browser/API validation from `docs/clerk-rollout-execution-runbook.md`
  - fill identity continuity and billing reconciliation evidence before cutover

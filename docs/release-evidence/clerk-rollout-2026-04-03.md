# Clerk Rollout Evidence - 2026-04-03

Release branch:

- `codex/clerk-auth-migration`

PR:

- `https://github.com/ROOOU/novel-to-script/pull/1`

Release commit:

- `42648d2`

## 1. Engineering Health Gates

- [x] `npm run typecheck`
  - output: pass
- [x] `npm test`
  - output: `77 files passed, 231 tests passed`
- [x] `npm run build`
  - output: pass (dynamic routes rendered as expected; no build blocker)
- [ ] `npm run preflight:production`
  - output: pass in production deploy context (`[env-preflight] mode=production`, before deployment `dpl_7JkCmqFNNYworJKZR95fL2SWSmR5`)
- [x] CI links:
  - latest PR checks: `CI / Typecheck, Test, and Build` green (PR #1)

## 2. Session + Route Validation

- [ ] `GET /api/auth/session` (authenticated)
  - request id:
  - response snippet: blocked (requires production-like authenticated Clerk session)
- [x] signed-out redirect checks
  - routes checked:
    - `GET /` -> `307` `location=/zh-CN`
    - `GET /en-US/projects` -> `307` `location=/en-US/login`
    - `GET /en-US/billing` -> `307` `location=/en-US/login`
  - screenshot links: replaced by `smoke:rollout` output (curl/fetch evidence)
- [ ] signed-in no-loop checks
  - routes checked:
  - screenshot links: blocked (manual browser pass pending)
- [x] generation route 401 checks (signed out)
  - `/api/generate` response: `401 {"ok":false,"error":"UNAUTHORIZED"}`
  - `/api/storyboard` response: `401 {"ok":false,"error":"UNAUTHORIZED"}`
- [x] rollout smoke report captured
  - command: `BASE_URL=https://app.012294.xyz npm run smoke:rollout`
  - deployment: `dpl_7JkCmqFNNYworJKZR95fL2SWSmR5` (`https://app.012294.xyz`, production READY)
  - core rows:
    - `GET /api/auth/session` -> `401 {"ok":false,"error":"UNAUTHORIZED"}`
    - `POST /api/generate` -> `401 {"ok":false,"error":"UNAUTHORIZED"}`
    - `POST /api/storyboard` -> `401 {"ok":false,"error":"UNAUTHORIZED"}`

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

## 4.5 Ops Owner Validation

- [ ] Clerk production instance + domain verified
  - verifier:
  - timestamp:
  - screenshot/link:
- [ ] Google OAuth production redirect URIs verified
  - verifier:
  - timestamp:
  - screenshot/link:
- [ ] Vercel production deployment + DATABASE_URL safety verified
  - verifier:
  - timestamp:
  - deployment link:
- [ ] stop-condition checklist reviewed before traffic cutover
  - verifier:
  - timestamp:
  - notes:

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

- decision: NO-GO for production cutover from this validation pass
- approvers:
- timestamp: 2026-04-03 (Asia/Shanghai)
- follow-up actions:
  - run `npm run preflight:production` in production env context and capture pass output
  - execute manual browser/API validation from `docs/clerk-rollout-execution-runbook.md`
  - fill identity continuity and billing reconciliation evidence before cutover
  - complete signed-in no-loop verification and Ops owner checklist items

## 7. Stop/Rollback Readiness

- [ ] rollback checklist validated pre-release
  - previous auth/env config snapshot:
  - rollback owner:
  - restore steps link:
- rollback_triggered: `no`
- rollback_timestamp:
- rollback_reason:

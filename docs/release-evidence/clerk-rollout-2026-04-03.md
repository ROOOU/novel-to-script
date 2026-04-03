# Clerk Rollout Evidence - 2026-04-03

Release branch:

- `codex/clerk-auth-migration`

PR:

- `https://github.com/ROOOU/novel-to-script/pull/1`

Release commit:

- `<fill-me>`

## 1. Engineering Health Gates

- [ ] `npm run typecheck`
  - output:
- [ ] `npm test`
  - output:
- [ ] `npm run build`
  - output:
- [ ] `npm run preflight:production`
  - output:
- [ ] CI links:

## 2. Session + Route Validation

- [ ] `GET /api/auth/session` (authenticated)
  - request id:
  - response snippet:
- [ ] signed-out redirect checks
  - routes checked:
  - screenshot links:
- [ ] signed-in no-loop checks
  - routes checked:
  - screenshot links:
- [ ] generation route 401 checks (signed out)
  - `/api/generate` response:
  - `/api/storyboard` response:

## 3. Identity Continuity

- [ ] legacy user linked correctly
  - local user id:
  - org id:
  - continuity notes:
- [ ] new user bootstrap complete
  - local user id:
  - org id:
  - workspace id:
  - subscription id:
  - credit account id:

## 4. Billing + Webhook Validation

- [ ] credit-pack purchase
  - order id:
  - local organization id:
  - ledger/credit update:
- [ ] subscription purchase
  - provider subscription id:
  - local subscription state:
- [ ] webhook reconciliation
  - event ids:
  - verification status:

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
- approvers:
- timestamp:
- follow-up actions:

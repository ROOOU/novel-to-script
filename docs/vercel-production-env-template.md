# Vercel Production Environment Template

Target domain: `https://app.012294.xyz`

## Required

These must be set before a real production deployment.

```env
NEXT_PUBLIC_APP_URL=https://app.012294.xyz

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

DATABASE_URL=postgres://...

OPENAI_API_KEY=your_openai_compatible_provider_key
OPENAI_BASE_URL=https://your-provider.example.com/v1
MODEL_NAME=your-model-name

PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=live
PAYPAL_WEBHOOK_ID=...
PAYPAL_PLAN_ID_CREATOR=...
PAYPAL_PLAN_ID_PRO=...
```

## Recommended

These are not hard blockers, but are strongly recommended for production reliability.

```env
REDIS_URL=redis://...

DATABASE_POOL_SIZE=1
DATABASE_IDLE_TIMEOUT=20
DATABASE_CONNECT_TIMEOUT=10
```

## Optional

Only set these if you intentionally use the related compatibility path.

```env
API_KEY=
API_BASE_URL=
PAYPAL_PLAN_ID=
NOVELSCRIPT_AUTH_SECRET=
```

Do not rely on `NOVELSCRIPT_STORE_PATH` in Vercel production. Vercel filesystem storage is not durable enough for the app's primary data.

## Do Not Reuse From Local

Do not copy these local-development values into Vercel production:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
PAYPAL_MODE=sandbox
NOVELSCRIPT_STORE_PATH=.novelscript/store
```

## Vercel Entry Plan

Set these in the `Production` environment first:

1. `NEXT_PUBLIC_APP_URL`
2. Clerk live keys
3. `DATABASE_URL`
4. `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `MODEL_NAME`
5. PayPal live variables
6. `REDIS_URL` if you want queued processing instead of inline execution

## Platform Notes

1. `DATABASE_URL` is mandatory for real production use on Vercel.
2. `NEXT_PUBLIC_APP_URL` must match the real public domain exactly.
3. This app supports OpenAI-compatible providers. Keep `OPENAI_API_KEY` as the auth variable name, and point `OPENAI_BASE_URL` plus `MODEL_NAME` at your actual provider.
4. Clerk production domain and Google OAuth origins/redirects must be updated to `app.012294.xyz` before launch.
5. `app.012294.xyz` is already connected at the DNS and Vercel project layer, but no production deployment has been promoted yet.

# call-agent-web

Public landing for **Treena** (https://usetreena.com).

Hosted on Cloudflare Pages project `call-agent`. Source of truth is Nathan’s Astra static landing (localhost:4173 / `outputs/relay`), Relay→Treena rename applied. Do not restyle from the Pages screenshot rebuild.

Landing capability map: [`docs/FEATURE_MAP.md`](docs/FEATURE_MAP.md).

## Stripe TEST paywall

Flow: landing → `/pricing` → `/account` (email + E.164 phone + account-level retain opt-in, default off, persists with login) → `/pay` → Stripe Checkout (TEST) → `/start` (Text Treena). No trial. Plans are Personal $20/mo (30 min) and Plus $40/mo (90 min) only. Privacy default-wipe policy is documented in FEATURE_MAP as sot-ready; the privacy page claim is gated / not-shipped until call-agent hangup delete matches. Hangup wipe is TRE-23 on `natecl/call-agent`, not this repo.

The secret key never ships in `public/`. Pages Functions at `/api/checkout`, `/api/session`, `/api/webhook`, and `/api/account` hold `STRIPE_SECRET_KEY`. After checkout/settings, they POST signed JSON to Fly `/accounts/sync` (HMAC `ACCOUNT_SYNC_SECRET`). Fly is the sole writer of `users`. This website does not open `NEON_DATABASE_URL`. Do not claim that writer live. Pages deploy is held unless Cap already ordered it.

### Local

1. Copy `.dev.vars.example` to `.dev.vars` and paste **TEST** keys only (`sk_test_` / `pk_test_`). Keys live on Nathan’s Mac `call-agent/.env` and box secrets — do not commit them.
2. Optional: `STRIPE_PRICE_PERSONAL` / `STRIPE_PRICE_PLUS` if you created Products in the Stripe TEST dashboard (account email `nathan@usetreena.com`). If omitted, Checkout uses inline price_data for $20 / $40 monthly.
3. Optional: `STRIPE_WEBHOOK_SECRET` for `POST /api/webhook`.
4. Optional: `ACCOUNT_SYNC_SECRET` (same value as Fly) and `CALL_AGENT_SYNC_URL` or `PUBLIC_BASE_URL` for signed `POST /accounts/sync`.
5. `npm install`
6. `npm run verify`
7. `npm run dev` then open `/pricing`.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

### Pages (project `call-agent`)

Set Production and Preview env (Workers & Pages → `call-agent` → Settings → Variables and Secrets). Encrypt the secret. Do not put `sk_live_`.

| name | kind | required |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | secret | yes (`sk_test_` only) |
| `STRIPE_PUBLISHABLE_KEY` | env / secret | yes (`pk_test_`) |
| `STRIPE_PRICE_PERSONAL` | env | no |
| `STRIPE_PRICE_PLUS` | env | no |
| `STRIPE_WEBHOOK_SECRET` | secret | no (needed only if you register `/api/webhook`) |
| `ACCOUNT_SYNC_SECRET` | secret | no (same HMAC as Fly; needed to POST `/accounts/sync`) |
| `CALL_AGENT_SYNC_URL` | env | no (defaults to `https://hidden-beacon-080.fly.dev/accounts/sync`) |
| `PUBLIC_BASE_URL` | env | no (Fly origin; used as `{PUBLIC_BASE_URL}/accounts/sync` when `CALL_AGENT_SYNC_URL` is unset) |

Wrangler equivalent (values are prompted, never echoed here):

```sh
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name=call-agent
npx wrangler pages secret put STRIPE_PUBLISHABLE_KEY --project-name=call-agent
```

Webhook URL in Stripe TEST: `https://usetreena.com/api/webhook` (and the Pages preview host if you use it). Events: `checkout.session.completed`, `customer.updated`, `customer.subscription.updated`, `customer.subscription.deleted`.

### Deploy

```sh
npx wrangler pages deploy public --project-name=call-agent
```

Do not start Fly Machines. Do not deploy live Stripe.

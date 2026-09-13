# call-agent-web

Public landing for **Treena** (https://usetreena.com).

Hosted on Cloudflare Pages project `call-agent`. Source of truth is Nathan’s Astra static landing (localhost:4173 / `outputs/relay`), Relay→Treena rename applied. Do not restyle from the Pages screenshot rebuild.

Landing capability map: [`docs/FEATURE_MAP.md`](docs/FEATURE_MAP.md). Cloud Agents: [`AGENTS.md`](AGENTS.md). Verifier: `npm run verify` (GitHub Actions `ci`).

TRE-22 unfroze home. Pixel owns restyle. Keep “Your phone call agent, right in iMessage.” Shared Treena iMessage number is `+12138653024` (Linq sandbox; ride until ~Sep 18).

## Stripe TEST paywall

Flow: landing (TRE-22 unfrozen) → `/pricing` → `/account` (email + password + E.164 **user** phone + account-level retain opt-in, default off; **no name field**; Google + Apple buttons; copy: name lives in account settings after signup) → `/pay` Stripe Checkout (**TEST**, Cap/ops hold on live keys) → `/start` (collect name if missing; same settings copy) → `/dashboard` (HTML may already be on Pages; **sot-ready**, Cap has not GO’d product-live). `/login` is a real page (Google + Apple + email). No trial. Plans are Personal $20/mo (30 min) and Plus $40/mo (90 min) only. Privacy page is shipped on web. Hangup wipe is TRE-23 on `natecl/call-agent`, not this repo.

Everyone texts one shared Treena iMessage bot (`+12138653024`). The account `phone` field is the user’s own number. This website does not assign a per-user Treena DID.

The secret key never ships in `public/`. Pages Functions at `/api/checkout`, `/api/session`, `/api/webhook`, `/api/account`, `/api/dashboard`, and `/api/billing` hold `STRIPE_SECRET_KEY`. After checkout/settings, they POST signed JSON to Fly `/accounts/sync` (HMAC `ACCOUNT_SYNC_SECRET`). Dashboard HMAC-GETs Fly `/accounts/dashboard?phone=` (HMAC over the E.164 phone). Fly is the sole writer of `users`. This website does not open `NEON_DATABASE_URL`. Do not claim Fly sync live.

### Local

1. Copy `.dev.vars.example` to `.dev.vars` and paste **TEST** keys only (`sk_test_` / `pk_test_`). Keys live on Nathan’s Mac `call-agent/.env` and box secrets — do not commit them.
2. Optional: `STRIPE_PRICE_PERSONAL` / `STRIPE_PRICE_PLUS` if you created Products in the Stripe TEST dashboard (account email `nathan@usetreena.com`). If omitted, Checkout uses inline price_data for $20 / $40 monthly.
3. Optional: `STRIPE_WEBHOOK_SECRET` for `POST /api/webhook`.
4. Optional: `ACCOUNT_SYNC_SECRET` (same value as Fly) and `CALL_AGENT_SYNC_URL` or `PUBLIC_BASE_URL` for signed `POST /accounts/sync` and HMAC `GET /accounts/dashboard`.
5. `npm install`
6. `npm run verify`
7. Optional live host check: `VERIFY_LIVE_ORIGIN=https://usetreena.com npm run verify` (GET `/` SHA + iMessage subhead). Unset is the default CI path.
8. `npm run dev` then open `/pricing`.

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
| `ACCOUNT_SYNC_SECRET` | secret | no (same HMAC as Fly; needed to POST `/accounts/sync` and GET `/accounts/dashboard`) |
| `CALL_AGENT_SYNC_URL` | env | no (defaults to `https://hidden-beacon-080.fly.dev/accounts/sync`) |
| `PUBLIC_BASE_URL` | env | no (Fly origin; used as `{PUBLIC_BASE_URL}/accounts/sync` when `CALL_AGENT_SYNC_URL` is unset) |
| `PUBLIC_TREENA_IMESSAGE_E164` | env | no (defaults to `+12138653024`; ops swap-later) |
| `LINQ_FROM_E164` | env | no (same sandbox DID; used if `PUBLIC_TREENA_IMESSAGE_E164` is unset) |
| `GOOGLE_CLIENT_ID` | env | no (Google OAuth; start URL names this if missing) |
| `GOOGLE_CLIENT_SECRET` | secret | no |
| `APPLE_CLIENT_ID` | env | no (Services ID) |
| `APPLE_TEAM_ID` | env | no |
| `APPLE_KEY_ID` | env | no |
| `APPLE_PRIVATE_KEY` | secret | no (`.p8` PEM; `\n` escaped is OK) |
| `AUTH_SESSION_SECRET` | secret | no (signed auth cookie + OAuth state; required for Google/Apple to complete) |
| `AUTH_PUBLIC_ORIGIN` | env | no (defaults to the request origin; set `https://usetreena.com` if callbacks must stay on prod) |

### Google / Apple (ops)

Redirect URIs to register when secrets exist:

- `https://usetreena.com/api/auth/google/callback`
- `https://usetreena.com/api/auth/apple/callback`

If those env keys are missing, `/login` and `/account` still show the buttons. `/api/auth/google` and `/api/auth/apple` redirect back to `/login.html` with `auth_error` plus the exact missing key names. Do not invent client IDs or Apple private keys in this repo.

### Stripe live (HOLD)

Cap/ops 2026-09-13: **do not flip TEST → live.** Pages + Fly still use `sk_test_` / `pk_test_`. Code rejects `sk_live_` / `pk_live_`. When Cap says live secrets are installed, the live-ready env path is the same names with live prefixes (`STRIPE_SECRET_KEY=sk_live_…`, `STRIPE_PUBLISHABLE_KEY=pk_live_…`, live `STRIPE_WEBHOOK_SECRET`, live `STRIPE_PRICE_PERSONAL` / `STRIPE_PRICE_PLUS`). Until then keep TEST.

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

Do not start Fly Machines. Do not deploy live Stripe. Stripe stays TEST until Cap GO.

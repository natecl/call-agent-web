# call-agent-web

Public landing for **Treena** (https://usetreena.com).

Hosted on Cloudflare Pages project `call-agent`. Source of truth is Nathan’s Astra static landing (localhost:4173 / `outputs/relay`), Relay→Treena rename applied. Do not restyle from the Pages screenshot rebuild.

Landing capability map: [`docs/FEATURE_MAP.md`](docs/FEATURE_MAP.md). Cloud Agents: [`AGENTS.md`](AGENTS.md). Verifier: `npm run verify` (GitHub Actions `ci`).

TRE-22 unfroze home. Pixel owns restyle. Keep “Your phone call agent, right in iMessage.” Shared Treena iMessage number is `+12138653024` (Linq sandbox; ride until ~Sep 18).

## Stripe paywall

Flow: landing (TRE-22 unfrozen) → `/pricing` → `/account` (email + password + E.164 **user** phone + account-level retain opt-in, default off; **no name field**; Google + Apple buttons; copy: name lives in account settings after signup; **Google/Apple identity skips Your details and continues at Review & pay**) → `/pay` Stripe Checkout (**live** when Pages has `sk_live_`; TEST copy only on `sk_test_`) → `/start` (collect name if missing; same settings copy) → `/dashboard` (HTML may already be on Pages; **sot-ready**, Cap has not GO’d product-live). `/login` is a real page (Google + Apple + email). No trial. Plans are Personal $20/mo (30 min) and Plus $40/mo (90 min) only. Privacy page is shipped on web. Hangup wipe is TRE-23 on `natecl/call-agent`, not this repo. Complimentary prove grant: Pages env `COMPLIMENTARY_ENTITLEMENT_EMAILS` (comma-separated) entitles those emails to `/dashboard` **without a Stripe charge** (Customer only; no subscription, no Checkout Session). Complimentary is test-only: Manage billing is hidden; do not open Customer Portal. Paying users keep portal. Unset to reverse.

Everyone texts one shared Treena iMessage bot (`+12138653024`). The account `phone` field is the user’s own number. This website does not assign a per-user Treena DID.

The secret key never ships in `public/`. Pages Functions at `/api/checkout`, `/api/session`, `/api/webhook`, `/api/account`, `/api/dashboard`, `/api/billing`, `/api/billing/portal`, `/api/billing/cancel`, and `/api/billing/pack` hold `STRIPE_SECRET_KEY`. After checkout/settings, they POST signed JSON to Fly `/accounts/sync` (HMAC `ACCOUNT_SYNC_SECRET`). Dashboard HMAC-GETs Fly `/accounts/dashboard?phone=` (HMAC over the E.164 phone). Fly is the sole writer of `users`. This website does not open `NEON_DATABASE_URL`. Do not claim Fly sync live. Signed-in Treena accounts hitting `/` go to `/dashboard`. Cap-locked packs: **$1.00 per 5 connected minutes**, max 12 packs (60 extra minutes), no auto-meter.

### Local

1. Copy `.dev.vars.example` to `.dev.vars` and paste keys. Local default is **TEST** (`sk_test_` / `pk_test_`). Pages Production is **live** after Cap GO (`sk_live_` / `pk_live_`). Keys live on Nathan’s Mac `call-agent/.env` and Pages secrets — do not commit them.
2. Optional: `STRIPE_PRICE_PERSONAL` / `STRIPE_PRICE_PLUS` if you created Products in the Stripe TEST dashboard (account email `nathan@usetreena.com`). If omitted, Checkout uses inline price_data for $20 / $40 monthly.
3. Optional: `STRIPE_PRICE_MINUTE_PACK`. If omitted, pack Checkout uses inline price_data for **$1.00 / 5 connected minutes** (max 12 packs / 60 extra minutes; no auto-meter).
4. Optional TEST-only: `DASHBOARD_USAGE_SEED=ok|approaching|at_cap|after_pack|pack_cap`. Ignored when Stripe is live (`sk_live_`).
5. Optional: `STRIPE_WEBHOOK_SECRET` for `POST /api/webhook`.
6. Optional: `ACCOUNT_SYNC_SECRET` (same value as Fly) and `CALL_AGENT_SYNC_URL` or `PUBLIC_BASE_URL` for signed `POST /accounts/sync` and HMAC `GET /accounts/dashboard`.
7. `npm install`
8. `npm run verify`
9. Optional live host check: `VERIFY_LIVE_ORIGIN=https://usetreena.com npm run verify` (GET `/` SHA + iMessage subhead). Unset is the default CI path.
10. `npm run dev` then open `/pricing`.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

### Pages (project `call-agent`)

Set Production and Preview env (Workers & Pages → `call-agent` → Settings → Variables and Secrets). Encrypt secrets. Production is live (`sk_live_` / `pk_live_`) after Cap GO 2026-09-14. Do not commit live keys to git.

| name | kind | required |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | secret | yes (`sk_test_` or `sk_live_`) |
| `STRIPE_PUBLISHABLE_KEY` | env / secret | yes (`pk_test_` or `pk_live_`, matching the secret) |
| `STRIPE_PRICE_PERSONAL` | env | no |
| `STRIPE_PRICE_PLUS` | env | no |
| `STRIPE_PRICE_MINUTE_PACK` | env | no (omit → inline **$1.00** / 5 min pack) |
| `DASHBOARD_USAGE_SEED` | env | no (TEST-only: `ok` / `approaching` / `at_cap` / `after_pack` / `pack_cap`) |
| `STRIPE_WEBHOOK_SECRET` | secret | **unset** — `POST /api/webhook` returns 503 until ops sets `whsec_…`. Do not invent. Checkout/session still live. |
| `ACCOUNT_SYNC_SECRET` | secret | no (same HMAC as Fly; needed to POST `/accounts/sync` and GET `/accounts/dashboard`) |
| `CALL_AGENT_SYNC_URL` | env | no (defaults to `https://hidden-beacon-080.fly.dev/accounts/sync`) |
| `PUBLIC_BASE_URL` | env | no (Fly origin; used as `{PUBLIC_BASE_URL}/accounts/sync` when `CALL_AGENT_SYNC_URL` is unset) |
| `PUBLIC_TREENA_IMESSAGE_E164` | env | no (defaults to `+12138653024`; ops swap-later) |
| `LINQ_FROM_E164` | env | no (same sandbox DID; used if `PUBLIC_TREENA_IMESSAGE_E164` is unset) |
| `GOOGLE_CLIENT_ID` | env | no (Google OAuth; start URL names this if missing) |
| `GOOGLE_CLIENT_SECRET` | secret | no |
| `APPLE_CLIENT_ID` | env | no (defaults to Services ID `com.usetreena.signin`) |
| `APPLE_TEAM_ID` | env | no |
| `APPLE_KEY_ID` | env | no |
| `APPLE_PRIVATE_KEY` | secret | no (`.p8` PEM; `\n` escaped is OK) |
| `AUTH_SESSION_SECRET` | secret | no (signed auth cookie + OAuth state; required for Google/Apple to complete) |
| `AUTH_PUBLIC_ORIGIN` | env | no (defaults to the request origin; set `https://usetreena.com` if callbacks must stay on prod) |
| `COMPLIMENTARY_ENTITLEMENT_EMAILS` | env | no (comma-separated). Allowlisted emails get `/dashboard` with **no Stripe charge** (Customer created; no subscription). Test-only: Manage billing hidden; no Customer Portal. Reversible: unset. Do not invent pricing. |

### Google / Apple (ops)

Redirect URIs (already documented; register these):

- `https://usetreena.com/api/auth/google/callback`
- `https://usetreena.com/api/auth/apple/callback`

Apple Services ID / client: `com.usetreena.signin`. `www.usetreena.com` pins OAuth callbacks to the apex origin. Optional origin pin: `AUTH_PUBLIC_ORIGIN=https://usetreena.com`.

If Google/Apple env keys are missing, `/login` and `/account` still show the buttons. `/api/auth/google` and `/api/auth/apple` redirect back to `/login` with `auth_error` plus the exact missing key names. Do not invent client secrets or Apple private keys in this repo.

Google Cloud OAuth consent is **External** (test users / publish). That is product/ops, not a code invent. Until Google publishes the app (or adds test users), Google sign-in can fail at Google’s consent screen even when Pages secrets are set.

### Stripe live (Cap GO 2026-09-14)

Nathan via Cap: live keys are installed on Pages. Checkout follows the secret prefix (`sk_live_` → live Checkout Sessions `cs_live_`; `sk_test_` stays TEST for CI/local). Code no longer rejects `sk_live_`. Do not commit live keys. `STRIPE_WEBHOOK_SECRET` is still unset — webhook verify stays gated.

Wrangler equivalent (values are prompted, never echoed here):

```sh
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name=call-agent
npx wrangler pages secret put STRIPE_PUBLISHABLE_KEY --project-name=call-agent
```

Webhook URL in Stripe (when ops sets `STRIPE_WEBHOOK_SECRET`): `https://usetreena.com/api/webhook` (and the Pages preview host if you use it). Events: `checkout.session.completed`, `customer.updated`, `customer.subscription.updated`, `customer.subscription.deleted`.

### Deploy

```sh
npx wrangler pages deploy public --project-name=call-agent
```

Do not start Fly Machines. Cloud Agents must not deploy Pages.

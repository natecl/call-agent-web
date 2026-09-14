# AGENTS.md

Cloud Agents in `natecl/call-agent-web` (public Treena site, Cloudflare Pages project `call-agent`).

## Verify

```sh
npm run verify
```

That is `scripts/verify-paywall.mjs`. Keep [`docs/FEATURE_MAP.md`](docs/FEATURE_MAP.md) truthful and in lockstep with it. Default CI has no secrets (mock Stripe / mock Fly). Optional: `VERIFY_LIVE_ORIGIN=https://usetreena.com` GETs live `/` and checks SHA-256 plus “Your phone call agent, right in iMessage.”

Status words: **shipped**, **sot-ready**, **not-started**.

## TRE-22 home

Home is unfrozen. Pixel restyle from `recover/treena-ui-redesign` is **UI-only**. Keep “Your phone call agent, right in iMessage.” Header Log in + Text Treena (`sms:+12138653024`) stay.

## Treena UI redesign

UI-only: `public/treena-theme.css` (tokens and page styling), `public/motion.js` (nav/page/focus motion), `public/app.js` (home demo and scroll playback), `public/dashboard-ui.css` / `public/dashboard-ui.js` (dashboard presentation). Visual brief: [`docs/TREENA_DESIGN_SYSTEM.md`](docs/TREENA_DESIGN_SYSTEM.md). Preserve existing IDs, routes, forms, and API contracts. Do not rewrite billing, OAuth, or CTA destinations.

## Accounts (this repo)

- `/account` — email + password + E.164 **user** phone + retain. **No `#name`.** Copy: name lives in account settings after signup. Google + Apple sign-up buttons are present.
- `/login` — Google + Apple + email path. Must be a real page (not homepage fallthrough).
- `/start` — collect name after pay. Same settings copy.
- `/dashboard` — HTML may already be on Pages GET `/dashboard`. Status **sot-ready** (Cap has not GO’d product-live). Fly sync is sot-ready; do not claim that writer live. Signed-in account holders hitting `/` or `/login` are routed here. Billing period dates are Stripe/Fly only (never invented). Manage billing is Stripe Customer Portal for **paid** accounts. Complimentary grants (`COMPLIMENTARY_ENTITLEMENT_EMAILS`) are test-only: hide/disable Manage billing; do not open Customer Portal (no Checkout Session). Cancel is end-of-period. Account settings: name + **user** phone (not Treena’s shared bot) + retain (default off, Fly sync). Complimentary prove: ops `COMPLIMENTARY_ENTITLEMENT_EMAILS` (comma-separated). No live charge. Reversible. Do not invent pricing.
- Shared Treena iMessage bot for everyone: `+12138653024` (Linq sandbox `LINQ_FROM_E164` / L1 prove; ride until ~Sep 18). Override: `PUBLIC_TREENA_IMESSAGE_E164`. Each account stores the user’s own phone. Do not invent a per-user Treena DID.
- Stripe is **env-driven**. Cap GO 2026-09-14: Pages Production has `sk_live_` / `pk_live_`. CI mock stays `sk_test_`. Do not commit live keys.
- Google + Apple: callbacks `https://usetreena.com/api/auth/google/callback` and `https://usetreena.com/api/auth/apple/callback`. Apple Services ID `com.usetreena.signin`. Google consent External (test users/publish) is product/ops.
- `STRIPE_WEBHOOK_SECRET` unset — `POST /api/webhook` is 503 until ops sets it. Do not invent the secret. Checkout/session still live.

Privacy page is shipped on web.

## Do not

- Deploy Pages
- L1 redial / live Linq messaging
- Put a name field on `/account`
- Invent `STRIPE_WEBHOOK_SECRET` or live keys in git
- Fly accounts, hangup wipe, or `verify-accounts` (those are `natecl/call-agent`)

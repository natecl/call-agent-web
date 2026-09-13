# AGENTS.md

Cloud Agents in `natecl/call-agent-web` (public Treena site, Cloudflare Pages project `call-agent`).

## Verify

```sh
npm run verify
```

That is `scripts/verify-paywall.mjs`. Keep [`docs/FEATURE_MAP.md`](docs/FEATURE_MAP.md) truthful and in lockstep with it. Default CI has no secrets (mock Stripe / mock Fly). Optional: `VERIFY_LIVE_ORIGIN=https://usetreena.com` GETs live `/` and checks SHA-256 plus “Your phone call agent, right in iMessage.”

Status words: **shipped**, **sot-ready**, **not-started**.

## TRE-22 home

Home is unfrozen. Pixel owns restyle. Do not invent a product UX redesign. Keep “Your phone call agent, right in iMessage.”

## Accounts (this repo)

- `/account` — email + password + E.164 **user** phone + retain. **No `#name`.** Copy: name lives in account settings after signup. Google + Apple sign-up buttons are present.
- `/login` — Google + Apple + email path. Must be a real page (not homepage fallthrough).
- `/start` — collect name after TEST pay. Same settings copy.
- `/dashboard` — HTML may already be on Pages GET `/dashboard`. Status **sot-ready** (Cap has not GO’d product-live). Fly sync is sot-ready; do not claim that writer live.
- Shared Treena iMessage bot for everyone: `+12138653024` (Linq sandbox `LINQ_FROM_E164` / L1 prove; ride until ~Sep 18). Override: `PUBLIC_TREENA_IMESSAGE_E164`. Each account stores the user’s own phone. Do not invent a per-user Treena DID.

Privacy page is shipped on web.

## Do not

- Deploy Pages
- L1 redial / live Linq messaging
- Put a name field on `/account`
- Live Stripe (`sk_live_` / `pk_live_`) — Cap/ops hold; Pages+Fly stay `sk_test_` / `pk_test_` until Cap says live secrets are installed
- Fly accounts, hangup wipe, or `verify-accounts` (those are `natecl/call-agent`)

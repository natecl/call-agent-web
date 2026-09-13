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

- `/account` — email + password + E.164 phone + retain. **No `#name`.** Copy: name lives in account settings after signup.
- `/start` — collect name after TEST pay. Same settings copy.
- `/dashboard` — HTML may already be on Pages GET `/dashboard`. Status **sot-ready** (Cap has not GO’d product-live). Fly sync is sot-ready; do not claim that writer live.

Privacy page is shipped on web.

## Do not

- Deploy Pages
- L1 redial / live Linq messaging / wave 2
- OAuth
- Put a name field on `/account`
- Live Stripe (`sk_live_`)
- Fly accounts, hangup wipe, or `verify-accounts` (those are `natecl/call-agent`)

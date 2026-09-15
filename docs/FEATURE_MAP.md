# Landing feature map

This file maps the public landing as a product surface. It is not an implementation plan.

## Current UI rebrand — shipped on live `/` (measured)

Cap 2026-09-14 (Nathan): UI-only from `recover/treena-ui-redesign` @ `5b942e7` plus chrome lock this session. Presentation lives in `public/treena-theme.css`, `public/motion.js`, `public/app.js` (demo/scroll), `public/dashboard-ui.css` / `public/dashboard-ui.js`. Visual brief: [TREENA_DESIGN_SYSTEM.md](TREENA_DESIGN_SYSTEM.md). Ink canvas, Manrope, sage actions. Shared header: tab row (Pricing / Privacy / How it works / What it can do, pricing pill/active treatment) sits **next to the Treena logo** (left-aligned, not centered) plus **Get started** then **Log in** on the far right. Cap 2026-09-15 (Nathan): hero primary is **Text Treena** (`pricing.html`, same destination as header Get started). Label stays **Text Treena**. Do not change Get started or Log in. Closing CTA is **Get started**. Subhead stays “Your phone call agent, right in iMessage.” Dashboard billing period / Customer Portal / cancel EOP / settings / retain stay wired for **paid** accounts. Complimentary grant is test-only: hide Manage billing; do not open Customer Portal (no Checkout Session). OAuth skip-to-pay from #19 stays.

Working-tree `public/index.html` is 9391 bytes, SHA-256 `b5d43832d0d18911dc1b7b2dd24dabd98b384c26f49325f5743f5bc5227cc6cd`. Live `/` remains 9395 bytes, SHA-256 `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316`, measured GET `https://usetreena.com/` and `https://www.usetreena.com/` (sms hero) until Pages deploy. Optional `VERIFY_LIVE_ORIGIN` re-checks that live SHA and the iMessage subhead. Dashboard stays **sot-ready** (Cap has not GO’d product-live). This agent must not deploy Pages.

## Wave 2 surfaces (#17–#24)

Git `main` includes #17–#24. Live static `/`, `/login`, `/start`, `/dashboard` HTML and `/checkout.js` SHAs match git main (measured). That is **not** Cap GO for dashboard product-live. Fly sync stays sot-ready. CI `npm run verify` is mock Stripe / mock Fly. Stay Stripe TEST. No dial.

| PR | surface | FEATURE_MAP rows | git | live |
| --- | --- | --- | --- | --- |
| #17 | OAuth / login / shared iMessage | `auth-login-page`, `auth-google-apple`, `cta-shared-imessage` | merged | `/login` is a real page (title Log in — Treena), measured. Home sms is `+12138653024`. |
| #18 | dashboard billing backend | `dashboard-billing-period`, `dashboard-billing-portal`, `dashboard-cancel-plan`, `dashboard-account-settings`, `dashboard-retain-persist`, `logged-in-home-route` | merged | HTML on Pages GET `/dashboard`. **sot-ready** — Cap has not GO’d product-live. |
| #19 | OAuth skip-to-pay + complimentary grant | `auth-google-apple`, `dashboard-complimentary-grant` | skip as merge vehicle (GitHub PR still open); code is on `main` via later PRs | Complimentary is test-only. Manage billing hide is #21. |
| #20 | redesign UI | `visual-system-rebrand` | merged | Live `/` loads `treena-theme.css` (ink/Manrope/sage), measured. |
| #21 | chrome polish + complimentary Manage billing hide | `nav-primary-cta`, `dashboard-complimentary-grant` | merged | Header **Get started** then **Log in** live on `/`. Grant portal hide is verify-mock; not product-live GO. |
| #22 | hero Text Treena + left nav | `hero-primary-cta`, `nav-in-page-links` | merged | Live `/` SHA-256 `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316` (9395 B). Hero **Text Treena** (no “to get started”). Tabs left of logo. |
| #23 | portal CSRF after dashboard load | `dashboard-billing-portal` | merged | Live `/checkout.js` SHA matches git. CSRF prove is `npm run verify` mock. Not dashboard product-live. Stay Stripe TEST. |
| #24 | `/start` session persist | `post-pay-name` | merged | Live `/start` and `/dashboard` HTML SHAs match git. Name Continue persist prove is `npm run verify` mock. Not dashboard product-live. |

Cap 2026-09-15 (Nathan): post-pay `/start` order **LOCKED**: (1) Name (2) Phone confirm (user E.164, not Treena bot) (3) How to text Treena (`+12138653024` / `PUBLIC_TREENA_IMESSAGE_E164`) (4) Dashboard. Extends the #24 name-only path. Junk `session_id` still ignored; paid cookie survives. Stay Stripe TEST. This working tree changes `/start` HTML; live `/start` stays the #24 name-only page until Pages deploy. This agent must not deploy.

## Account + Stripe paywall

TRE-22 unfroze home. Pixel restyle is UI-only in this working tree. Keep “Your phone call agent, right in iMessage.”

TRE-17 checkout is **env-driven**. Cap GO 2026-09-14 (Nathan via Cap): live Stripe keys are installed on Pages (`sk_live_` / `pk_live_`). Code accepts `sk_test_` (CI mock) or `sk_live_` (Production). The browser never holds the secret. KYC is still out of scope. Google + Apple sign-up is wired (`/api/auth/google/callback`, `/api/auth/apple/callback`; Apple Services ID `com.usetreena.signin`). Google OAuth consent is External (test users / publish) — product/ops, not a code invent. `STRIPE_WEBHOOK_SECRET` is unset; `POST /api/webhook` returns 503 until ops sets it. Checkout/session live flip still ships. The account record is a Stripe Customer + subscription. Fly `users` is the runtime account kickoff reads. This website POSTs signed TRE-20 Customer JSON to Fly `POST /accounts/sync`; it does not write Neon. Do not claim Fly sync live. Dashboard HTML may already be on Pages GET `/dashboard`; status stays **sot-ready** (Cap has not GO’d product-live). One shared Treena iMessage bot (`+12138653024`) for everyone; each account stores the user’s own phone. Not a per-user Treena DID.

| route | file | status | notes |
| --- | --- | --- | --- |
| `/` | `public/index.html` | shipped | TRE-22 unfrozen. Keep “Your phone call agent, right in iMessage.” Working-tree SHA-256 `b5d43832d0d18911dc1b7b2dd24dabd98b384c26f49325f5743f5bc5227cc6cd` (9391 B). Live `/` SHA-256 `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316` (9395 B) until Pages deploy. Pixel restyle is UI-only (`treena-theme.css`). Header: tab row left-aligned next to the logo; far-right **Get started** (pricing) then **Log in**. Hero primary is **Text Treena** (`pricing.html`, same as Get started). Closing CTA is **Get started**. |
| `/pricing.html` | `public/pricing.html` | shipped | Headline is Pricing. Lead: “Choose the plan you need…”. Two locked plan cards. Card CTAs go to account with `?plan=`. Do not jump to Text Treena from a pricing card. “What’s included in each plan?” FAQ starts closed. Same header chrome as home (Get started then Log in). Directory index: `public/pricing/index.html` (`/pricing/`). |
| `/login.html` | `public/login.html` | shipped | Google + Apple + email/password continue. Pretty URL `/login` (and `/login/`) must not fall through to home. Directory index: `public/login/index.html`. `_redirects` aliases `/signin` `/sign-in` `/log-in` → `/login`. |
| `/account.html` | `public/account.html` | shipped | Create-account form: **email + password required** unless a Google/Apple session is present (no `#name` on this page), **user phone required (E.164)** — not a Treena DID — account-level retain checkbox default off. Copy: **name lives in account settings after signup.** Name is collected on `/start` after checkout. Sign in with Google / Sign in with Apple present. **After Google/Apple identity is established, the wizard advances to Review & pay** (`/pay`) instead of staying on Your details. Password not sent to Stripe. Stripe Customer at checkout (env-driven live/TEST). Directory index: `public/account/index.html` (`/account/`). |
| `/pay.html` | `public/pay.html` | shipped | Confirms selected plan (price + minutes + overage). Signed-in Personal → Plus shows **Plus $40/mo going forward** and **Due today $20** (Pay $20). New Plus still Pay $40. OAuth return hydrates email from the auth session and **advances past Your details**. If user phone is not yet stored, `/pay` collects E.164 phone (retain still default off) before Checkout. Pay redirects to Stripe Checkout (live when `sk_live_` is set; TEST copy only if `sk_test_`). No trial. Secret is not in the page. Directory index: `public/pay/index.html` (`/pay/`). |
| `/start.html` | `public/start.html` | shipped | Post-pay onboarding after `GET /api/session` verifies a paid Checkout Session **or a signed-in paid account** (auth cookie). Cap order (Nathan) **LOCKED**: **(1) Name** (if Stripe Customer.name is missing; required form, not on `/account`; copy: **name lives in account settings after signup.**) **(2) Phone confirm** (user’s text-from number, E.164 — **not** Treena’s shared bot). **(3) How to text Treena** (published iMessage `+12138653024` / `PUBLIC_TREENA_IMESSAGE_E164` + first-text instructions). **(4) Dashboard.** Name → `POST /api/account` → Stripe Customer.name → HMAC sync `first_name` + `prefs.full_name`. Phone confirm → same POST with `assertUserPhone` (rejects `+12138653024` and Telnyx FROM). Paid users do **not** need `session_id` again after the first Checkout success: junk values (`null`, leftover storage) are ignored and the paid cookie is enough. Text Treena opens `sms:+12138653024` (env may swap). Directory index: `public/start/index.html` (`/start/`). Live Pages `/start` is still the #24 name-only HTML until deploy. |
| `/dashboard.html` | `public/dashboard.html` | sot-ready | Present on Pages GET `/dashboard`. Cap has not GO’d product-live. UI shell is the Plan & usage / Settings / Privacy account surface (`dashboard-ui.css` / `dashboard-ui.js`). Plan & usage keeps **Monthly usage** (remaining/reset) and **5-minute packs**; the redundant **Your current plan** module is removed. Personal ($20) shows **Upgrade plan** → `pay.html?plan=plus` (Stripe TEST paywall for Plus $40). Plus ($40) hides that CTA. Do not send dashboard plan CTAs to marketing `pricing.html`. Behavior: usage (**remaining** minutes + included/used + call count + approaching/at-cap; Stripe/Fly reset date when verified), **5-minute packs** ($1.00 each, max 12 / 60 extra min; no auto-meter), billing (TEST badge only when `sk_test_`; period/renewal dates from Stripe only; **paid** Manage billing via Customer Portal; cancel at period end), account settings (name + user phone + retain, default off), Linq L1 threads, agent observability (`call_report` / transcript when retained). Privacy summary (`#privacy-retain-heading`, `#dashboard-retain`) reflects persisted `settings.retainAfterCall` / Fly `retain_call_artifacts`; Settings remains the editor. Copy: **name lives in account settings after signup.** HMAC GET Fly `/accounts/dashboard`. Empty thread/obs arrays if `ACCOUNT_SYNC_SECRET` is missing. **Complimentary prove grant (test-only):** Pages env `COMPLIMENTARY_ENTITLEMENT_EMAILS` (comma-separated). Allowlisted emails get dashboard with **no Stripe charge** (Stripe Customer only; no subscription, no invoice, no Checkout Session). **Do not build Customer Portal for complimentary accounts.** Hide/disable Manage billing so they never hit `Missing live Checkout Session`. Packs are for paid plans (complimentary 403). Paying users keep the portal. Reversible: unset the env. Period dates stay Stripe-only (null without a subscription). Do not invent pricing. Directory index: `public/dashboard/index.html` (`/dashboard/`). |

Order: landing → `/login` or `/account` (Google/Apple or email+password) + pay (Stripe env-driven, no trial) → `/start` (name → phone confirm → how to text Treena → dashboard). Google/Apple on `/account` or `/login` skip Your details once identity is established and continue at Review & pay. A signed-in Treena account hitting `/` or `/login` is routed to `/dashboard`, not the landing. Home hero **Text Treena** is `pricing.html` (same as header Get started). Post-pay `/start` Text Treena is `sms:+12138653024` (shared bot). Complimentary allowlist emails skip Checkout (no charge) and land on `/dashboard`.

Locked plans only:

1. Personal — $20/mo · 30 connected min · $0.15/min overage
2. Plus — $40/mo · 90 min · $0.12/min

No trial. No free forever. No annual/team/enterprise.

Pages Functions: `POST /api/checkout`, `GET /api/session`, `GET /api/config`, `POST /api/webhook`, `GET/POST /api/account`, `GET /api/dashboard`, `GET /api/billing`, `POST /api/billing/portal`, `POST /api/billing/cancel`, `POST /api/billing/pack`, `GET/POST /api/auth/*` (Google + Apple). Checkout mode follows `STRIPE_SECRET_KEY` (`sk_test_` or `sk_live_`). `POST /api/webhook` gates on `STRIPE_WEBHOOK_SECRET` (unset → 503; do not invent). On `checkout.session.completed`, `customer.updated`, subscription updated/deleted, and post-pay name / settings save, Pages Functions HMAC-POST signed JSON to Fly `POST /accounts/sync` (`ACCOUNT_SYNC_SECRET`). Dashboard HMAC-GETs Fly `GET /accounts/dashboard?phone=` (HMAC over the E.164 **user** phone query value). Fly is the sole writer of `users`. This website does not open `NEON_DATABASE_URL`. Complimentary dashboard access is env-gated (`COMPLIMENTARY_ENTITLEMENT_EMAILS`); it creates a Stripe Customer and does **not** create a subscription, invoice, or Checkout Session. Complimentary is test-only — `POST /api/billing/portal` is 403 and Manage billing is hidden. Verifier: `npm run verify` (`scripts/verify-paywall.mjs`). CI runs that command (mock Stripe / mock Fly). Optional `VERIFY_LIVE_ORIGIN` GETs live `/` for SHA + iMessage subhead. Do not claim Fly sync live. Cap has not GO’d dashboard product-live. Stripe live flip is Cap GO (env-driven).

Out of scope: KYC, magic-link auth backend, Fly deploy / live Machines, Linq live messaging, L1 redial. Account form still does not send password to Stripe. Google + Apple sign-up is present; Pages secrets are installed. Google consent External (test users/publish) is product/ops. Name is not on signup — it is required on `/start` after pay, then phone confirm (user E.164) and how to text Treena before dashboard. Copy on `/account`, `/start`, and `/dashboard` says name lives in account settings after signup. Neon writes from this website are out of scope. Hangup wipe, Fly accounts, and `verify-accounts` live in `natecl/call-agent`. Do not invent a per-user Treena DID. Do not invent `STRIPE_WEBHOOK_SECRET`.

## Privacy

Nathan GO 2026-09-12: this locked copy **is live** at `https://usetreena.com/privacy` (Pages deploy from `867e411c`, project `call-agent`). Do not hold for Builder default-no-store — page copy shipped; TRE-20 account opt-in + TRE-23 wipe remain separate climbs.

| route | file | status | notes |
| --- | --- | --- | --- |
| `/privacy.html` | `public/privacy.html` | shipped | Headline is Privacy. Lead is the scare line. Directory index: `public/privacy/index.html` (`/privacy/`). Same chrome as other inner pages. |

Headline: Privacy. Lead (the scare line): We don’t store anything unless you opt in.

Body, in this order:

1. That includes call audio, transcripts, call history, and extra profile data — off by default. Nothing is saved after a call unless you turn saving on.
2. While a call is happening, audio passes through our providers so the call can run (Telnyx; OpenAI). When you haven’t opted in, we don’t keep it.
3. If you opt in, you choose what to keep (audio, transcript, and/or history). You can turn that off and ask us to delete what was saved.
4. On the call: the other party hears that it’s on behalf of your first name. Treena doesn’t say the product name.
5. We don’t sell your content as ads. You choose what to save, and you can ask us to delete what you’ve saved.
6. Contact: privacy@usetreena.com
7. Quieter secondary line (not the scare line): We keep account login and minute totals for billing.

Same chrome: Treena wordmark, nav, Text Treena, footer. Visual SoT is the existing inner-page system (white, Inter, `--blue` `#007AFF`, existing `.page-main`). Treena is a product, never she/her.

Old Ring five-claim blocks (outbound DID, audio for task+debug, AI disclosure, processors, no selling) are superseded. Do not invent extra legal claims: no HIPAA, no “we never store” without the opt-in exception already in this lock, not Signal-private, not end-to-end encrypted.

TRE-22 unfroze home. Keep “Your phone call agent, right in iMessage.” Pixel owns restyle. Cloud Agents: `AGENTS.md`.

## Status words

This map uses exactly three status values.

**shipped.** Present in this repo and on the live Pages host in a form that already satisfies that capability's SoT intent. TRE-22 unfroze home; Pixel owns restyle. Live `/` SHA is `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316` (9395 B). Working-tree home is 9391 B with hero **Text Treena** → `pricing.html`. Keep “Your phone call agent, right in iMessage.” A dark placeholder page is not the product landing. Dashboard product-live is not shipped.

**sot-ready.** Astra SoT specifies it in the attached overall-page frame, in `relay-agent-handoff.md`, in the Nathan-via-Cap brand lock this session, or in more than one of those. Approved design exists. Cap has not GO’d a product-live claim. Dashboard HTML present on Pages GET `/dashboard` stays sot-ready until Cap GO. Fly sync stays sot-ready — do not claim Fly sync live.

**not-started.** Not implemented. SoT does not specify it enough to build without inventing.

## Host today

The live consumer URLs are `https://usetreena.com` and `https://www.usetreena.com`, measured by GET this session. The Pages preview `https://call-agent-7qt.pages.dev/` still serves the same HTML.

The file that ships on that host is `public/index.html`. `README.md` is in the repo and is not served.

Working-tree `public/index.html` is 9391 bytes (SHA-256 `b5d43832d0d18911dc1b7b2dd24dabd98b384c26f49325f5743f5bc5227cc6cd`). The title is `Treena — You text. We call. Life moves.` The h1 is "You text. We call. Life moves." The subhead includes “Your phone call agent, right in iMessage.” The page is the Treena product landing on Cloudflare Pages project `call-agent`. It is not the old 997-byte dark placeholder. The HTML contains Treena, "You text", "Watch a call", "Life moves", and the iMessage line. It does not contain a `call-agent` h1 or TBD product-name copy, measured by reading the file this session.

Live `/` SHA-256 is `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316` (9395 B), measured GET this session (sms hero until Pages deploy). Optional `VERIFY_LIVE_ORIGIN` GET `/` re-checks that live SHA and the iMessage subhead. This agent must not deploy Pages. Dashboard stays sot-ready.

A GET of `https://call-agent-7qt.pages.dev/anything-missing` returns HTTP 200 and that same HTML, measured. `public/404.html` is absent.

The public brand is Treena, measured from Nathan via Cap this session and from the live HTML.

The consumer home domain is `usetreena.com`. Apex and `www` are live on Cloudflare Pages project `call-agent`, measured. HTTPS GET of `https://usetreena.com` and `https://www.usetreena.com` returns HTTP 200 and the Treena product landing. Live host `public/index.html` is 9395 bytes (SHA-256 `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316`) until Pages deploy. Working-tree home is 9391 bytes (SHA-256 `b5d43832d0d18911dc1b7b2dd24dabd98b384c26f49325f5743f5bc5227cc6cd`).

The product landing is present. TRE-22 unfroze home. Pixel restyle is UI-only in this working tree. Keep the iMessage subhead.

The SoT landing is static HTML with no build step. Entry files in SoT are `index.html`, `style.css`, `app.js`, and `assets/`, measured from `relay-agent-handoff.md`. This repo has `public/index.html`, `public/style.css`, `public/app.js`, and `public/assets/`, measured by listing the workspace this session. The live HTML links `style.css` and `app.js`.

Files under `docs/` are this map and `TREENA_DESIGN_SYSTEM.md`. `AGENTS.md` at repo root points Cloud Agents at this map and `npm run verify`. `relay-agent-handoff.md` is not in this git tree, measured. Pixel restyle CSS/JS/fonts are in `public/`.

## Capability registry

The Capability registry is a lookup table of landing capabilities. Each row is one capability. Columns are id, area, purpose, sot, repo, live, status, and evidence.

| id | area | purpose | sot | repo | live | status | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| host-product-landing | host | A visitor at the consumer URL sees the Treena product landing. | none | Working-tree `public/index.html` is 9391 bytes (SHA-256 `b5d43832d0d18911dc1b7b2dd24dabd98b384c26f49325f5743f5bc5227cc6cd`). Title is `Treena — You text. We call. Life moves.` Subhead includes “Your phone call agent, right in iMessage.” Nav, hero, demo, use-case band, and CTAs are present. It links `style.css`, `treena-theme.css`, `app.js`, and `imessage.js`. Hero Text Treena is `pricing.html`. | `https://usetreena.com` GET `/` this session is 9395 B SHA-256 `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316` (sms hero until Pages deploy). | shipped | measured. TRE-22 unfroze home. HTML contains Treena, "You text", "Watch a call", "Life moves", and the iMessage line. It does not contain a `call-agent` h1 or TBD product-name copy. |
| sot-static-entry | host | The SoT landing is static HTML with no build step. | Entry files are `index.html`, `style.css`, `app.js`, and `assets/`. | This repo has `public/index.html`, `public/style.css`, `public/app.js`, and `public/assets/`. | The live host serves that landing HTML and those linked files. | shipped | measured. `relay-agent-handoff.md` names those entry files. A workspace listing has those files. Live HTML links `style.css` and `app.js`. |
| domain-usetreena | host | The consumer home domain is `usetreena.com`. | Apex ALIAS and www CNAME point at `call-agent-7qt.pages.dev` on Cloudflare Pages project `call-agent`. | This repo has no DNS config. | `https://usetreena.com` and `https://www.usetreena.com` return HTTP 200 and the Treena product landing. | shipped | measured. GET of both hostnames this session. www CNAME is `call-agent-7qt.pages.dev`. Live `/` SHA-256 `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316` (9395 B) until Pages deploy. Working-tree home is 9391 B. |
| brand-public-treena | brand | The public brand is Treena. | Public brand is Treena. Locked. | `README.md` names Treena. `public/index.html` wordmark, title, CTAs, and iMessage contact are Treena. | The live page uses the same Treena copy. There is no TBD product-name copy. | shipped | measured. Nathan via Cap this session locked Treena. Live HTML contains Treena and does not say product name is TBD. |
| brand-relay-codename | brand | Relay is internal and legacy SoT. | Relay is the internal and legacy SoT codename. SoT mock wordmark lettering and "Text Relay" CTA copy may still use Relay-family strings. Those strings are not the public brand. | absent as a live name. Public CTAs say "Text Treena". | absent as a live name | shipped | measured. Nathan via Cap this session. Live HTML and `public/index.html` do not contain "Text Relay" or a `call-agent` h1. |
| brand-sot-wordmark | brand | The SoT landing shows a left nav wordmark. | The overall-page frame shows a left wordmark. The public shipping wordmark is Treena. Exact letter forms in that PNG may still be Relay-family. | `public/index.html` left nav wordmark is the text Treena. | The live page shows the same Treena wordmark. | shipped | measured. The attached frame shows a left wordmark. Live HTML wordmark is Treena. Exact PNG letter spelling is inferred. |
| nav-in-page-links | nav | A visitor uses the in-page labels "How it works" and "What it can do". | Those two labels sit in the nav next to the wordmark, not centered. | `public/index.html` nav has those two labels immediately after the Treena wordmark. CSS: `body .nav nav{margin-left:0}`; `.nav-end` stays `margin-left:auto`. Same chrome on inner pages. | Live GET `/` this session (9395 B). | shipped | measured. Cap 2026-09-14: left-align tab row with logo. |
| nav-link-targets | nav | A visitor who follows those labels reaches the sections they name. | none | "How it works" is `href="#how-it-works"`. "What it can do" is `href="#use-cases"`. `public/app.js` scrolls How it works to the demo. | The live page has the same hrefs and script. | shipped | measured. Those ids and hrefs are in `public/index.html`. `public/app.js` binds How it works to the demo. |
| nav-primary-cta | nav | A visitor sees a primary **Get started** button and **Log in** to its right. | The SoT frame button is solid with a pill shape. Cap 2026-09-14 chrome lock: header Get started (not sms); Log in on the far right. Tab row sits next to the wordmark (not centered). Same chrome on landing and inner pages (pricing pill/active treatment). | `public/index.html` `.nav-end` is Get started (`pricing.html`) then `login.html` Log in. Inner pages share that chrome. | Live GET `/` this session. Header Get started + Log in present. | shipped | measured. Cap chrome lock this session. Hero Text Treena now shares the pricing destination; header chrome is unchanged. |
| hero-headline | hero | A visitor reads "You text. We call. Life moves." | A yellow underline accent sits on "moves." | `public/index.html` h1 is that headline with an underline SVG on "moves." | The live page has the same headline. | shipped | measured. The attached frame shows the headline and the underline. Live HTML and `npm run verify` check "You text." |
| hero-subhead | hero | A visitor reads "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage." | That subhead sits under the headline. The product start is iMessage. | `public/index.html` has that subhead under the h1. | The live page has the same subhead. | shipped | measured. The attached frame shows the subhead. Live HTML contains it. `relay-agent-handoff.md` states that start is iMessage. |
| hero-primary-cta | hero | A visitor sees a solid **Text Treena** button under the subhead, next to Watch a call. | The SoT filled button uses "Text Relay". The public brand is Treena. Cap 2026-09-15: hero label stays **Text Treena**; destination is the same as header Get started (`pricing.html`). Do not change this control’s label to Get started. | `public/index.html` hero actions include a filled **Text Treena** button (`pricing.html`). `public/app.js` does not rewrite that href to sms. | Live GET `/` this session still has sms hero until Pages deploy. | shipped | measured. Cap 2026-09-15. Header Get started is unchanged. |
| hero-secondary-cta | hero | A visitor sees an outline "Watch a call" button with a play glyph. | The button is outline style with a play glyph. The outline button sits beside the filled CTA. | `public/index.html` has `#watch-call` with a play glyph and the label "Watch a call". | The live page has the same button. | shipped | measured. The attached frame shows the outline button and glyph. `npm run verify` checks "Watch a call". |
| hero-watch-call-target | hero | A visitor who chooses "Watch a call" reaches a destination that button names. | none | `public/app.js` scrolls to the demo and replays it. | The live page loads that script. | shipped | measured. `$('#watch-call')` in `public/app.js` calls `watchDemo()`. |
| phone-demo | phone-demo | A visitor sees one phone demo that pairs iMessage bubbles with matching iPhone frames. | The stage around the devices is pearl-gray and rounded. The call surface is dark. An iPhone iMessage thread sits on the left. A call UI sits on the right with a handset, Publix, a timer, a waveform, and a red end-call control. A hand-drawn cord connects them. The visitor texts Publix about oat milk stock. The agent places the call. The thread later shows in stock, aisle 6. This is the only functional demo. | `public/index.html` has that demo pair, cord, Publix oat milk thread, and call UI. | The live page has the same demo. | shipped | measured. Live HTML contains Publix, aisle 6, and the iMessage plus call pair. |
| phone-demo-annotations | phone-demo | A visitor reads "You text what you need." and "We call. You get the answer." | The demo stage has those margin notes. Working-tree restyle dropped the visible “Illustrative demo” label (visual only). | `public/index.html` has those two ink notes. Demo heading is “A simple text. Consider it handled.” | Live GET `/` this session. | shipped | measured. Those strings are in `public/index.html`. |
| phone-demo-live-captions | phone-demo | A visitor reads live captions outside the call surface. | Live captions sit outside the call surface. | `public/index.html` has `.live-caption` outside the call devices. | The live page has the same caption. | shipped | measured. `relay-agent-handoff.md` places live captions outside the call surface. Live HTML has `.live-caption`. |
| phone-demo-result-imessage | phone-demo | A visitor sees the demo result return to iMessage. | After the call, the result returns to iMessage. | `public/index.html` shows the answer bubble in the iMessage thread. `public/app.js` later sets the caption to "Answer sent to iMessage". | The live page has the same thread and script. | shipped | measured. `relay-agent-handoff.md` states that the result returns to iMessage. Repo HTML and `public/app.js` do that. |
| use-cases-headline | use-cases | A visitor reads "One text. One less thing to do." and "The everyday calls, handled." | Those lines are the band headline and subhead under the demo. | `public/index.html` has those two lines in `#use-cases`. | The live page has the same lines. | shipped | measured. The attached frame shows both lines. Live HTML contains them. |
| use-case-dinner | use-cases | A visitor sees the dinner scene "A table for two." | The art is a hand-drawn table and flower. Peach highlight sits on "two". Subcopy is "Dinner plans, without the phone call." | `public/app.js` dinner scene uses `A table` / `for two.` and that caption. Art is `public/assets/dining-retina-art.png`. | The live page loads that script and asset. | shipped | measured. `public/app.js` names that scene. The attached frame shows this first illustrated scene. |
| use-case-haircut | use-cases | The use-case carousel includes a haircut scene. | `relay-agent-handoff.md` names haircut. The attached crop does not show art, headline, or subcopy. | `public/app.js` has Haircuts / `off the top.` Art is `public/assets/haircut-yellow-art.png`. | The live page loads that script and asset. | shipped | measured. `relay-agent-handoff.md` lists haircut. `public/app.js` and `public/assets/` include it. |
| use-case-stock | use-cases | The use-case carousel includes a stock scene. | `relay-agent-handoff.md` names stock. The attached crop does not show art, headline, or subcopy. | `public/app.js` has Store stock / `make the trip.` Art is `public/assets/stock-retina-art.png`. | The live page loads that script and asset. | shipped | measured. `relay-agent-handoff.md` lists stock. `public/app.js` and `public/assets/` include it. |
| use-case-rescheduling | use-cases | The use-case carousel includes a rescheduling scene. | `relay-agent-handoff.md` names rescheduling. The attached crop does not show art, headline, or subcopy. | `public/app.js` has Rescheduling / `better time`. Art is `public/assets/reschedule-retina-art.png`. | The live page loads that script and asset. | shipped | measured. `relay-agent-handoff.md` lists rescheduling. `public/app.js` and `public/assets/` include it. |
| use-case-business-hours | use-cases | The use-case carousel includes a business hours scene. | `relay-agent-handoff.md` names business hours. The attached crop does not show art, headline, or subcopy. | `public/app.js` has Business hours / `Still open?` Art is `public/assets/hours-retina-art.png`. | The live page loads that script and asset. | shipped | measured. `relay-agent-handoff.md` lists business hours. `public/app.js` and `public/assets/` include it. |
| use-case-cycle | use-cases | A visitor sees a carousel of five illustrated use cases in the lower band. | The band is a carousel of dinner, haircut, stock, rescheduling, and business hours. Working-tree cycle timing is about 3.2s with whole-card transitions. It is not a second chat or call demo. | `public/app.js` cycles those five scenes every 3200ms. | Live `/app.js` SHA matches git this session. | shipped | measured. Working-tree restyle. `resetCycle()` uses 3200. |
| motion-viewport-playback | motion | Viewport playback advances one demo at a time. | `relay-agent-handoff.md` names viewport-aware playback. One demo advances at a time. | `public/app.js` `syncPlaybackFocus()` gives playback to the demo or the use-case band, not both. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names viewport-aware playback and one-at-a-time advance. `public/app.js` implements that focus. TRE-22 unfroze home; Pixel owns restyle. |
| motion-reduced-motion | motion | A visitor who prefers reduced motion sees a static path. | `relay-agent-handoff.md` names a reduced-motion static path. | `public/app.js` and `public/style.css` read `prefers-reduced-motion`. | The live page loads those files. | shipped | measured. `relay-agent-handoff.md` names the reduced-motion path. Repo files implement it. |
| motion-scene-transitions | motion | A visitor sees scene cycle transitions in the use-case band. | `relay-agent-handoff.md` names scene cycle and transitions. | `public/app.js` `showScene()` adds `scene-enter` / `scene-exit`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names scene cycle and transitions. `public/app.js` has those classes. |
| motion-preload | motion | Autoplay waits until images and fonts are loaded. | `relay-agent-handoff.md` names image and font load before autoplay. | `public/app.js` waits on `document.fonts.ready` and image `decode()` before `resetCycle()`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names that preload. `public/app.js` does that wait. |
| motion-settle-scene | motion | Landing motion settles the scene before the next advance. | `relay-agent-handoff.md` names `settleScene()`. Resize and visibility also settle. | `public/app.js` defines `settleScene()`. ResizeObserver and visibility change call it. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names `settleScene()` and resize and visibility settle. `public/app.js` has those calls. |
| motion-transition-ids | motion | Scene transitions use named transition IDs. | `relay-agent-handoff.md` names transition IDs. | `public/app.js` has `transitionId`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names transition IDs. `public/app.js` declares `transitionId`. |
| motion-use-case-timing | motion | The use-case carousel cycles at about 3.2s. | Working-tree restyle holds each result for 3.2s. | `public/app.js` `setTimeout(..., 3200)`. | Live `/app.js` SHA matches git this session. | shipped | measured. UI-only motion from recover/treena-ui-redesign. |
| cta-message-url-stub | cta-integration | Post-pay Text Treena follows the shared Treena sms URL. | SoT used empty `RELAY_MESSAGE_URL` as a coming-soon stub. Cap 2026-09-13 published Linq sandbox DID `+12138653024`. | `public/imessage.js` + `functions/_lib/imessage.js` default `+12138653024`. Env `PUBLIC_TREENA_IMESSAGE_E164` or `LINQ_FROM_E164` can swap. `GET /api/config` exposes `imessage`. Home hero is `pricing.html` and is not rewritten to sms. | Live `/start` uses `sms:+12138653024`, measured. Live `/` hero is still sms until Pages deploy. | shipped | measured. Cap-confirmed sandbox DID. Ops may swap via env. |
| cta-coming-soon-dialog | cta-integration | Coming-soon copy is gone. Dialog is fallback only if the sms URL is empty. | Empty URL used to open coming soon. Number is now published. | `#contact-dialog` copy is “Text Treena at +12138653024.” Post-pay `/start` CTA is `sms:+12138653024`. Home hero is `pricing.html`. | Live `/` has no coming-soon CTA, measured. | shipped | measured. Cap published the number. |
| cta-shared-imessage | cta-integration | Sitewide shared Treena iMessage bot is `+12138653024`. | Cap/ops: Linq sandbox `LINQ_FROM_E164` / L1 prove. Ride until ~Sep 18. | One source of truth in `imessage.js` / `_lib/imessage.js`. `/start` Text Treena and dialog copy. Home hero is pricing, not sms. | Live `/start` uses `sms:+12138653024`, measured. Live `/` hero is still sms until Pages deploy. | shipped | measured. Not a per-user DID. |
| auth-login-page | auth | `/login` is a real page, not homepage fallthrough. | Cap wave 2. | `public/login.html`, `public/login/index.html`, `public/_redirects` `/login` → `/login.html` 200. | Live GET `/login` title is Log in — Treena (5096 B), measured. | shipped | measured. Title is Log in — Treena. Not the home h1. |
| auth-google-apple | auth | Google OAuth + Apple sign-up are present. After OAuth, signup continues at Review & pay when identity is established. | Nathan via Cap: Google + Apple. Apple Services ID `com.usetreena.signin`. Cap 2026-09-14: do not stay on Your details after Google. | `/login` + `/account` buttons. `GET /api/auth/google` and `/api/auth/apple`. Callbacks `https://usetreena.com/api/auth/google/callback` and `https://usetreena.com/api/auth/apple/callback`. Missing ops keys are named (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `AUTH_SESSION_SECRET`). `APPLE_CLIENT_ID` defaults to `com.usetreena.signin`. `continuePathAfterIdentity` sends unpaid OAuth to `/pay.html?plan=`. | Ops installed Pages secrets. Google consent External (test users/publish) is product/ops. Live `/login` shows Google + Apple buttons, measured. | shipped | measured. Buttons present. Callbacks env-gated. www host pins to apex. |
| account-shared-bot-user-phone | account | One shared Treena bot number; each account stores the user’s own phone. | Cap read. | Stripe Customer `phone` / Fly `phone` is the user E.164. Treena DID is not per-user. Phone hint says it is the number they’ll text from. | sot-ready Fly writer. | shipped | measured. No per-user Treena DID in this schema. |
| cta-no-backend | cta-integration | Home still has no signup form or calling API. Hero Text Treena goes to pricing. | `relay-agent-handoff.md` states that the landing has no calling backend. | Home hero Text Treena is `pricing.html` (same as Get started). Stripe checkout is other routes. `/login` and `/account` hold Google/Apple. Post-pay `/start` still opens iMessage. | Live `/` has no signup form, measured. | shipped | measured. Home has no signup form. |
| account-fly-sync | account | Website POSTs signed TRE-20 account JSON to Fly `POST /accounts/sync`. Fly is the sole writer of `users`. Web does not write Neon. | Nathan lock sync B. call-agent `docs/accounts.md`. | `functions/_lib/sync.js` HMAC `ACCOUNT_SYNC_SECRET` (`X-Account-Sync-Signature: sha256=<hex>`). URL is `CALL_AGENT_SYNC_URL` or `PUBLIC_BASE_URL/accounts/sync`. Map: Customer `phone` → `phone`; optional `name` → `first_name` (first token) + `prefs.full_name` (signup does not collect name; post-pay `/start` does); `id` → `stripe_customer_id`; `metadata[plan]` → `plan`; `metadata[minutes]` → `minutes_included`; `retain_after_call=on` → `retain_call_artifacts`. `minutes_used` is omitted (Fly omit-preserve; explicit `0` would write 0). Triggers: `checkout.session.completed`, `customer.updated`, `customer.subscription.updated` / `deleted`, `POST /api/account` (Stripe first, then Fly). Retry 5xx. | Do not claim Fly sync live. Writer is not product-live. | sot-ready | measured. `npm run verify` / `verify-paywall` TEST path. No Neon. Fly accounts live in `natecl/call-agent`. |
| post-pay-name | account | After checkout, `/start` runs Cap’s locked order: name → phone confirm (user E.164, not Treena bot) → how to text Treena (`+12138653024` / `PUBLIC_TREENA_IMESSAGE_E164`) → dashboard. Copy on `/account`, `/start`, and `/dashboard` says name lives in account settings after signup. Continue does not require a Checkout Session id again when the paid auth cookie is present. | Cap accounts climb PR2 + Cap 2026-09-15 onboarding lock (Nathan). Collect name on `/start`, confirm user phone, show published iMessage number + instructions, then dashboard. Cap TEST re-prove 2026-09-14: `session_id` must survive name Continue / dashboard re-entry (junk ignored; paid cookie survives). | `public/start.html` `#start-name` / `#name`, `#start-phone` / `#start-phone-form` / `#start-user-phone`, `#start-ready` how-to-text (`data-imessage-e164`, `sms:+12138653024`) + `#start-dashboard`. `POST /api/account` writes Stripe Customer.name / phone then HMAC sync. Client rejects reserved bot numbers. Junk `session_id` (`null`) is ignored; paid cookie / stored `cs_test_` / `cs_live_` is enough. `/account.html` has no `#name`. Copy: “Name lives in account settings after signup.” | GET `/start` serves the page (live HTML is still #24 name-only until Pages deploy). `/account` has no `#name`. Fly sync of that name stays sot-ready. Persist prove is `npm run verify` mock — not dashboard product-live. | shipped | measured. `npm run verify`. Working-tree `/start` has name + phone confirm + how-to-text + dashboard continue. Settings copy is on account, start, and dashboard. |
| account-fly-dashboard | account | Website HMAC-GETs Fly `GET /accounts/dashboard?phone=`. Web does not open Neon or R2. | call-agent PR #35. | `functions/_lib/sync.js` `getAccountDashboard`. HMAC over the E.164 phone query value (`X-Account-Sync-Signature`). URL derived from sync origin. Missing `ACCOUNT_SYNC_SECRET` returns empty `threads` / `calls`. | HTML may already be on Pages GET `/dashboard`. Cap not GO for product-live. Do not claim Fly-backed dashboard live. | sot-ready | measured. `npm run verify` mocked Fly GET. Present on Pages. Cap has not GO’d. |
| dashboard-usage | dashboard | Dashboard shows remaining minutes, included/used, call count, and cap state (ok / approaching / at cap). | Cap 2026-09-14 seed + remaining. | `public/dashboard.html` `#usage`. Remaining = included + prepaid − used. Fly `minutes_used` wins over TEST seed. Approaching is remaining ≤ 5; at cap is remaining 0. TEST-only `DASHBOARD_USAGE_SEED` (`ok`, `approaching`, `at_cap`, `after_pack`, `pack_cap`; `sk_test_` only, live ignores). Copy: usage totals update after calls. Plan & usage does **not** repeat a **Your current plan** module or a second Minutes reset line. | Present on Pages GET `/dashboard`. Cap not GO for product-live. Fly ledger still sot-ready. | sot-ready | measured. `npm run verify` remaining + seed + Fly-wins. |
| dashboard-upgrade-plan | dashboard | Personal ($20) dashboard plan CTA is **Upgrade plan** and opens the Stripe paywall for Plus. Checkout charges **$20 today** (delta only, not a new $40 Plus subscription). After pay, the account **is Plus $40/mo** going forward (`proration_behavior: none`). Plus hides the CTA. Never marketing landing. | Cap 2026-09-15 (Nathan). Both locks: charge path = $20 delta; post-upgrade plan = Plus $40. | `#usage [data-upgrade-plan]` and Settings subscription. Label **Upgrade plan**. Destination `pay.html?plan=plus`. Hidden when `billing.plan` is `plus` or complimentary. Signed-in Personal accounts are allowed through `/pay?plan=plus` instead of bouncing to `/dashboard`. `/api/checkout` for an active Personal subscriber targeting Plus is Stripe Checkout `mode=payment` unit_amount **2000** (`kind=personal_to_plus`), not `STRIPE_PRICE_PLUS`. Success `/dashboard.html?session_id=` (webhook often 503). `verifyCheckoutSession` / webhook switch the existing subscription item to Plus $40 and set customer `metadata[plan]=plus`. | Not product-live until Cap GO / Pages deploy. Stay Stripe TEST. Do not invent time-based Stripe proration. | sot-ready | measured. `npm run verify` $20 payment checkout + Plus $40 subscription switch + Upgrade plan href. |
| dashboard-minute-pack | dashboard | Prepaid packs: **$1.00 per 5 connected minutes**. Max **12 packs / 60 extra minutes**. No auto-meter at included cap — must buy packs. | Cap pricing LOCK 2026-09-14. | `POST /api/billing/pack` → Stripe Checkout `mode=payment` $1.00 (`STRIPE_PRICE_MINUTE_PACK` or inline `price_data` unit_amount 100). Success `/dashboard.html?pack=ok` (not `session_id`). Complimentary 403. 12-pack cap 409. Dashboard `#minute-pack` `#buy-pack`. Stripe TEST in CI. Pack **price is locked** — not blocked on pack price. | Not product-live until Cap GO / Pages deploy. Fly prepaid ledger stays sot-ready. | sot-ready | measured. `npm run verify` TEST $1.00 checkout, 409 at 12 packs, complimentary 403. |
| dashboard-billing-test | dashboard | Dashboard billing follows Stripe env mode (TEST badge when `sk_test_`; live when `sk_live_`). | Cap GO 2026-09-14 live keys. | `functions/api/billing.js` + dashboard `#billing` `.test-badge` (`data-stripe-test-only`). Accepts `cs_live_` with `sk_live_`. | Present on Pages GET `/dashboard`. Cap not GO for product-live. Live keys installed; this agent must not deploy. | sot-ready | measured. Env-driven Stripe path. HTML on Pages. Cap has not GO’d dashboard product-live. |
| dashboard-billing-period | dashboard | Billing-period reset/renewal dates come from Stripe (and Fly if present). Never fictional. | Cap dashboard backend order. | `functions/_lib/billing.js` `periodFromSubscription` reads `current_period_start` / `current_period_end` (or item-level). Null when Stripe omits them. Dashboard rows `#billing [data-period-row]` / `[data-renews-row]` stay hidden without a verified ISO. Minutes reset is shown on Monthly usage only (not a second plan module). | HTML on Pages GET `/dashboard`. Not product-live until Cap GO. | sot-ready | measured. `npm run verify` asserts null dates when Stripe has none. |
| dashboard-billing-portal | dashboard | Paid Manage billing opens Stripe Customer Portal. Complimentary grants do not. | Cap dashboard backend order + 2026-09-14 complimentary lock. QA: Invalid CSRF after dashboard load. | `POST /api/billing/portal` → Stripe `billing_portal/sessions` for paid accounts. Complimentary (`COMPLIMENTARY_ENTITLEMENT_EMAILS` / grant flag, no subscription) is 403 and `#manage-billing` is hidden. Auth + CSRF (`X-Treena-CSRF` and JSON `csrf`). First CSRF mint is stable for the email so `/api/auth/me` and `/api/dashboard` cannot disagree. Return URL `/dashboard`. | Live `/checkout.js` SHA matches git. CSRF prove is `npm run verify` mock. Not dashboard product-live until Cap GO. Portal must be enabled on the Stripe account (ops). Stay Stripe TEST until Cap flip-back. | sot-ready | measured. Mock portal URL for paid. Load→portal CSRF roundtrip. Grant path refuses portal. |
| dashboard-cancel-plan | dashboard | Cancel plan is end-of-period with a real Stripe effective date. CSRF + ownership. | Cap dashboard backend order. | `POST /api/billing/cancel` sets `cancel_at_period_end=true`. Confirm UI on dashboard. Verifier does not hit live Stripe. | Not product-live until Cap GO. | sot-ready | measured. `npm run verify` mock cancel. No live cancel. |
| dashboard-account-settings | dashboard | Profile/account settings: name, email (readonly), user phone, retain. Phone is the number they text from, not Treena’s shared bot. | Cap dashboard backend order. Name lives in account settings after signup. | `#settings` on `/dashboard`. `GET/POST /api/account` requires checkout session or auth. `saveAccountSettings` writes Stripe then Fly. Rejects `+12138653024` and Telnyx FROM `+12135690899`. | Not product-live until Cap GO. | sot-ready | measured. `npm run verify` reserved-phone 400. |
| dashboard-retain-persist | dashboard | Privacy retain preference persists (default off) and syncs Fly. Privacy summary reflects that persisted state. | Cap dashboard backend order. Privacy scare line. Cap Stripe TEST e2e 2026-09-14: privacy summary must not stay “Off by default” after retain is on. | Settings `#settings-retain` unchecked by default. POST maps `retain_after_call` → Fly `retain_call_artifacts`. Account signup checkbox remains default off. Privacy `#privacy-retain-heading` / `#dashboard-retain` read `settings.retainAfterCall` (then Fly `retain_call_artifacts`). Settings remains the editor; summary re-renders after save. | sot-ready Fly writer. | sot-ready | measured. Existing settings save → Fly. Dashboard form wires the same POST. Privacy summary is UI-only against that persisted preference. |
| logged-in-home-route | auth | If the visitor has a Treena account (session), `/` and `/login` go to `/dashboard`, not the landing. | Nathan product lock via Cap. | `functions/_middleware.js` + `public/app.js` (sessionStorage checkout + `/api/auth/me`). OAuth `finishSession` sends existing subscribers (and complimentary grants) to `/dashboard`. | Not product-live until Cap GO. | sot-ready | measured. `npm run verify` middleware + `shouldRouteToDashboard`. |
| dashboard-complimentary-grant | dashboard | Allowlisted emails can open `/dashboard` with no Stripe charge. Complimentary is test-only. Manage billing is hidden — no Customer Portal, no Checkout Session. | Cap prove order 2026-09-14, then lock: do not build portal for grant accounts; hide Manage billing so they never hit `Missing live Checkout Session`. Paying users keep portal. | Pages env `COMPLIMENTARY_ENTITLEMENT_EMAILS` (comma-separated). `functions/_lib/entitlement.js` `isComplimentaryGrant`. Creates a Stripe Customer only — no subscription, no invoice, no invented period dates. `POST /api/billing/portal` returns 403. Dashboard `#manage-billing` hidden. Unset the env to reverse. Locked Personal plan is used only as the existing prove surface (not new pricing). | Not product-live until Cap GO + ops env. Cap has not GO’d dashboard product-live. | sot-ready | measured. `npm run verify` mock grant refuses portal. |
| dashboard-threads | dashboard | Dashboard lists Linq L1 threads. | Cap accounts climb PR2. | `public/dashboard.html` `#threads`. Empty: “No threads yet. Text Treena at +12138653024.” | Present on Pages GET `/dashboard`. Cap not GO for product-live. | sot-ready | measured. HTML on Pages. Cap has not GO’d. |
| dashboard-observability | dashboard | Dashboard shows retained `call_report` / transcript. Default wipe stays empty. | Cap accounts climb PR2. Hangup wipe is call-agent. | `public/dashboard.html` `#observability`. Empty: “Call details weren’t saved. That’s the default. Turn on save in account settings to keep transcripts and reports.” | Present on Pages GET `/dashboard`. Cap not GO for product-live. | sot-ready | measured. HTML on Pages. Cap has not GO’d. |
| visual-system | visual-system | SoT frame was a white canvas, bold Inter headings, and blue filled CTAs. | The frame has a yellow underline and a peach word highlight. First-session handoff names the typeface Inter. | Legacy `public/style.css` is white/Inter. Live `/` loads `public/treena-theme.css` after that (ink canvas, Manrope, sage). | Live host is the ink/Manrope landing, not a dark placeholder. | shipped | measured. Live `/` SHA-256 `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316`. TRE-22 unfroze home; Pixel restyle is UI-only. Keep the iMessage subhead. |
| visual-system-rebrand | visual-system | Live presentation is ink `#181818`, Manrope, sage CTAs, two-phone demo, matching inner pages and dashboard shell. | recover/treena-ui-redesign @ `5b942e7`. Cap: UI chrome lock this session. | `public/treena-theme.css`, Manrope fonts, `treena-mark.svg` / `treena-icon.svg`, `motion.js`, `dashboard-ui.css` / `dashboard-ui.js`. Header tab row left of Get started + Log in. Hero **Text Treena** → `pricing.html`. | Live GET `/` this session loads `treena-theme.css`. Dashboard product behavior stays sot-ready. | shipped | measured. UI chrome live. Paid billing portal and OAuth stay. Complimentary portal hidden. |
| sot-overall-page-frame | sot-assets | The approved overall-page frame is the composition source for this map. | The attached file is `09-illustrated-use-cases.png`. The PNG is not in git. | absent | absent | sot-ready | measured. The parent task attached the PNG. The workspace file list has no SoT image. |
| sot-handoff-md | sot-assets | `relay-agent-handoff.md` is a source for this map. | That file is measured handoff text from the parent task. It is not in this git tree. | absent | absent | sot-ready | measured. The parent task named that file. A workspace listing has no copy of it. |

## Sections

### Host

The live consumer host is `https://usetreena.com`, with `https://www.usetreena.com` as well, measured. The Pages preview `https://call-agent-7qt.pages.dev/` still serves the same Treena landing HTML.

The SoT landing is static HTML with no build step. Entry files are `index.html`, `style.css`, `app.js`, and `assets/`, measured from `relay-agent-handoff.md`. This repo has those files under `public/`.

The consumer home domain is `usetreena.com`. It is live on Cloudflare Pages project `call-agent`. Status is shipped. TRE-22 unfroze home. Pixel owns restyle. Keep the iMessage subhead.

### Nav

The SoT nav has a left wordmark, two in-page labels, and a right primary button, measured from the attached frame.

The public shipping wordmark is Treena, measured from Nathan via Cap this session and from `public/index.html`. The attached frame shows a left wordmark. Exact letter spelling in that PNG may still be Relay-family. That gap is inferred.

The visible labels are "How it works" and "What it can do", measured. Destinations are `#how-it-works` and `#use-cases`, measured from `public/index.html`. How it works also scrolls to the demo, measured from `public/app.js`.

The right cluster is a primary **Get started** pill then **Log in** to its right, measured. Tab row (Pricing, Privacy, How it works, What it can do) sits next to the Treena wordmark, left-aligned, not centered. SoT copy was "Text Relay". Header Get started is not sms. Hero primary is **Text Treena** to `pricing.html`.

The repo has that nav, measured. Live GET `/` this session serves the same HTML (9395 B).

### Hero

The SoT headline is "You text. We call. Life moves." A yellow underline sits on "moves.", measured. The live h1 is that headline, measured.

The SoT subhead is "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage.", measured. `relay-agent-handoff.md` states the same product shape. The visitor texts. The agent calls businesses on their behalf. The start is iMessage, measured from `relay-agent-handoff.md`. The live page has that subhead, measured.

Two CTAs sit under the subhead, measured. The filled button is **Text Treena** (`pricing.html`, same destination as header Get started). Do not change this hero control’s label to Get started. The outline button is "Watch a call" with a play glyph.

"Watch a call" scrolls to the demo and replays it, measured from `public/app.js`.

The repo and the live host have that hero, measured. TRE-22 unfroze home. Keep the iMessage subhead.

### Phone demo

The SoT page has one functional demo, measured from the attached frame and `relay-agent-handoff.md`. The live page has that demo, measured.

A pearl-gray rounded stage holds two devices, measured. That stage can remain around the devices. The call surface is dark. `relay-agent-handoff.md` names iMessage bubbles, matching iPhone frames, and a dark call surface.

The left device shows an iPhone iMessage thread with the agent. The right device shows a call UI with Publix, a timer, a waveform, and an end-call control. The call header is "Treena is calling", measured from `public/index.html`. A hand-drawn cord connects the two.

Margin notes read "You text what you need." and "We call. You get the answer." The demo section aria-label starts with "Illustrative demo", measured.

Live captions sit outside the call surface, measured from `relay-agent-handoff.md` and from `.live-caption` in `public/index.html`. The result returns to iMessage, measured from `relay-agent-handoff.md` and from the answer bubble.

The demo narrative in the frame is oat milk stock at Publix, measured. The visitor texts to ask whether oat milk is in stock. The agent places the call. The call UI shows the agent speaking. The thread later shows in stock, aisle 6.

The lower band is not a second chat or call demo, measured from `relay-agent-handoff.md`.

The repo and the live host have that phone demo, measured. TRE-22 unfroze home. Pixel owns restyle.

### Use cases

The SoT use-case band sits under the demo, measured. The live page has that band, measured.

The headline is "One text. One less thing to do." The subhead is "The everyday calls, handled.", measured.

The first illustrated scene in the frame is dinner, measured. The headline is "A table for two." Peach highlight sits on "two". Subcopy is "Dinner plans, without the phone call." `public/app.js` ships that scene.

`relay-agent-handoff.md` names four more scenes. The names are haircut, stock, rescheduling, and business hours. Those four are not visible in the attached crop. `public/app.js` and `public/assets/` include those four scenes, measured. This map does not invent crop copy for the PNG.

The band is a carousel of those five illustrated scenes, measured from `relay-agent-handoff.md` and from `public/app.js`. Working-tree cycle timing is 3200ms. It is not a second functional demo.

The repo and the live host have that use-case band, measured. TRE-22 unfroze home. Pixel owns restyle.

### Motion

`relay-agent-handoff.md` names these motion behaviors.

- Load images and fonts before autoplay.
- `settleScene()`.
- Transition IDs.
- Resize and visibility settle.
- A reduced-motion static path.
- Viewport playback. One demo advances at a time.
- Use-case cycle about 2.5s with smooth transitions.

Those behaviors are in this registry. They are implemented in `public/app.js` and `public/style.css`, measured. TRE-22 unfroze home. Pixel owns restyle.

### Integration stubs

The shared Treena iMessage number is `+12138653024` (`public/imessage.js`, `functions/_lib/imessage.js`, `PUBLIC_TREENA_IMESSAGE_E164` / `LINQ_FROM_E164`). Post-pay `/start` Text Treena uses `sms:+12138653024`. Home hero **Text Treena** uses `pricing.html` (same as Get started). Dialog copy names that number if the URL is empty. Pricing cards still go to `/account`, not the sms CTA.

No calling backend is connected on the landing. Stripe checkout is other routes (TRE-17, env-driven live). Google + Apple live on `/login` and `/account`. `STRIPE_WEBHOOK_SECRET` unset (webhook gated).

### Visual system

The attached frame is a white canvas, measured. Headings are bold and black. First-session handoff names the typeface Inter. Filled CTAs are blue. The demo stage is pearl-gray.

`relay-agent-handoff.md` names cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved, measured from `relay-agent-handoff.md`.

Pastels are restrained. A yellow underline and a peach word highlight appear in the frame.

First-session handoff names the visual direction useful, simple, warm, and polished.

The live host loads `treena-theme.css` (ink/Manrope/sage) after legacy `public/style.css`. It is not a dark scaffold at `#0b0c0f`. TRE-22 unfroze home. Keep the iMessage subhead. Dashboard product-live stays sot-ready.

### Brand

The public brand is Treena, measured from Nathan via Cap this session and from the live HTML.

Relay is the internal and legacy SoT codename, measured from Nathan via Cap this session. SoT mock wordmark lettering and "Text Relay" CTA copy may still use Relay-family strings. They are not the public brand. Live CTAs say "Text Treena", measured.

`public/index.html` title, wordmark, and h1 use Treena. They do not say product name is TBD. They do not use a `call-agent` h1, measured. `README.md` names Treena as the public landing.

The SoT frame shows a left wordmark, measured. The public shipping wordmark is Treena. Exact letter forms in that PNG may still be Relay-family. That spelling gap is inferred.

The consumer home domain is `usetreena.com`. It is live at `https://usetreena.com` and `https://www.usetreena.com`. Status for attach is shipped.

### SoT assets

The overall-page frame is the attached PNG `09-illustrated-use-cases.png`, measured from the parent task. That file is not in this git tree, measured. Landing illustration files under `public/assets/` are in git. They are not that PNG.

`relay-agent-handoff.md` is a second source. It is not in this git tree, measured. This repo does not contain a copy of that file.

## Proven versus inferred

**Measured from the attached overall-page frame.** The crop `09-illustrated-use-cases.png` shows the items below. The PNG is not in git.

- A left wordmark sits in the nav.
- The labels "How it works" and "What it can do" sit in the nav.
- A "Text Relay" pill sits on the right of the nav.
- The hero headline is "You text. We call. Life moves." with a yellow underline on "moves."
- The hero subhead is "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage."
- The hero CTAs are "Text Relay" and "Watch a call".
- A pearl-gray stage holds an iMessage thread and a call UI, joined by a hand-drawn cord.
- The demo narrative is Publix oat milk stock, then in stock, aisle 6.
- The demo notes are "You text what you need." and "We call. You get the answer." The caption is "Illustrative demo".
- The use-case headline and subhead are "One text. One less thing to do." and "The everyday calls, handled."
- The first illustrated scene is dinner, "A table for two.", with a peach highlight on "two".
- The canvas is white. Headings are bold and black. Filled CTAs are blue. Pastels are restrained.

**Measured from relay-agent-handoff.md.** That file is not in this git tree.

- The visitor texts. The agent calls businesses on their behalf. The start is iMessage.
- Taglines in SoT are "You text. We call. Life moves.", "One text. One less thing to do.", and "The everyday calls, handled."
- The SoT landing is static HTML with no build step. Entry files are `index.html`, `style.css`, `app.js`, and `assets/`.
- There is one functional phone demo. It uses iMessage bubbles and matching iPhone frames. The call surface is dark. The pearl-gray rounded stage from the PNG can remain as the stage around the devices.
- Live captions sit outside the call surface. The result returns to iMessage.
- The lower band is a carousel of five illustrated use cases. The scenes are dinner, haircut, stock, rescheduling, and business hours. Cycle timing is about 2.5s with smooth transitions. The band is not a second chat or call demo.
- Empty `RELAY_MESSAGE_URL` used to open a coming-soon dialog. Cap later published `+12138653024`. Phone numbers must not be invented; this DID is the Linq sandbox number already used for L1 prove.
- Motion names are load images and fonts before autoplay, `settleScene()`, transition IDs, resize and visibility settle, a reduced-motion static path, viewport playback with one demo advancing at a time, and use-case cycle about 2.5s with smooth transitions.
- The visual language uses cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved.

**Measured from first-session handoff facts.** Those facts arrived before `relay-agent-handoff.md` was named.

- Headings use Inter. The visual direction is useful, simple, warm, and polished.

**Measured from Nathan via Cap this session.**

- The public brand is Treena. Locked.
- The consumer home domain is `usetreena.com`. Bought.
- Relay is the internal and legacy SoT codename. Treena is the public brand.

**Measured from this repo and the live host.**

- `public/index.html` is the working-tree home page. It is 9391 bytes. SHA-256 is `b5d43832d0d18911dc1b7b2dd24dabd98b384c26f49325f5743f5bc5227cc6cd`. Live `/` remains 9395 bytes SHA-256 `4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316` until Pages deploy. TRE-22 unfroze home. Keep “Your phone call agent, right in iMessage.” Dashboard stays sot-ready.
- `https://usetreena.com`, `https://www.usetreena.com`, and `https://call-agent-7qt.pages.dev/` each return that HTML. Live `/` and an unknown path both return that HTML. HTTP 200.
- The HTML contains Treena, "You text", "Watch a call", and "Life moves". It does not contain a `call-agent` h1 or TBD product-name copy.
- Nav, hero, phone demo, use-case band, CTAs, and `public/app.js` are present. TRE-22 unfroze home. Pixel owns restyle. Keep the iMessage subhead.
- `public/style.css`, `public/app.js`, and `public/assets/` are in this repo.
- `relay-agent-handoff.md` is not in this git tree. README is not served. `public/404.html` is absent.

**Inferred.**

- Exact SoT frame wordmark lettering is not proven. The PNG may still show a Relay-family mock. The public shipping wordmark is Treena.
- Art and copy for haircut, stock, rescheduling, and business hours are not in the attached crop. The names are proven from `relay-agent-handoff.md`. The shipped landing includes those scenes in `public/app.js` and `public/assets/`. Crop lettering for those four is not proven from the PNG.

**Guess.**

- This map records no guesses.

## Out of scope

These items are outside this map.

- Inventing a new Pixel rebuild (this working tree applies `recover/treena-ui-redesign` visuals only; no product-flow changes)
- KYC / invented `STRIPE_WEBHOOK_SECRET`
- Google OAuth consent External (test users / publish) — product/ops
- Fly deploy / live Machines / Linq live messaging
- Cloudflare Git wiring
- Neon (website must not open `NEON_DATABASE_URL`; Fly is the sole writer of `users`)
- R2
- Workers other than Pages Functions for Stripe checkout, signed account sync, signed dashboard GET, Google/Apple OAuth callbacks, billing portal, and cancel-at-period-end
- The product calling stack in `natecl/call-agent` (this repo POSTs `/accounts/sync` and HMAC-GETs `/accounts/dashboard`; it does not run Fly)
- L1 redial / live Linq messaging / live call prove
- Per-user Treena DIDs (account phone is the user’s number; one shared bot `+12138653024`)

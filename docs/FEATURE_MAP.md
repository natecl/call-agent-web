# Landing feature map

This file maps the public landing as a product surface. It is not an implementation plan.

## Account + Stripe paywall

TRE-22 unfroze home. Pixel owns restyle. This map does not invent a home redesign. Keep “Your phone call agent, right in iMessage.”

TRE-17 checkout is **env-driven**. Cap GO 2026-09-14 (Nathan via Cap): live Stripe keys are installed on Pages (`sk_live_` / `pk_live_`). Code accepts `sk_test_` (CI mock) or `sk_live_` (Production). The browser never holds the secret. KYC is still out of scope. Google + Apple sign-up is wired (`/api/auth/google/callback`, `/api/auth/apple/callback`; Apple Services ID `com.usetreena.signin`). Google OAuth consent is External (test users / publish) — product/ops, not a code invent. `STRIPE_WEBHOOK_SECRET` is unset; `POST /api/webhook` returns 503 until ops sets it. Checkout/session live flip still ships. The account record is a Stripe Customer + subscription. Fly `users` is the runtime account kickoff reads. This website POSTs signed TRE-20 Customer JSON to Fly `POST /accounts/sync`; it does not write Neon. Do not claim Fly sync live. Dashboard HTML may already be on Pages GET `/dashboard`; status stays **sot-ready** (Cap has not GO’d product-live). One shared Treena iMessage bot (`+12138653024`) for everyone; each account stores the user’s own phone. Not a per-user Treena DID.

| route | file | status | notes |
| --- | --- | --- | --- |
| `/` | `public/index.html` | shipped | TRE-22 unfrozen. Keep “Your phone call agent, right in iMessage.” Live `/` SHA-256 `8c84c3b942ec59982fcbb3836307a44f67ee67054845fce0ab273bd7a14a7e45` (~8760 B) after this change lands. Pixel owns restyle. Text Treena opens `sms:+12138653024`. |
| `/pricing.html` | `public/pricing.html` | shipped | Headline is Pricing. Two locked plan cards. Card CTAs go to account with `?plan=`. Do not jump to Text Treena from a pricing card. Directory index: `public/pricing/index.html` (`/pricing/`). |
| `/login.html` | `public/login.html` | shipped | Google + Apple + email/password continue. Pretty URL `/login` (and `/login/`) must not fall through to home. Directory index: `public/login/index.html`. `_redirects` aliases `/signin` `/sign-in` `/log-in` → `/login`. |
| `/account.html` | `public/account.html` | shipped | Create-account form: **email + password required** unless a Google/Apple session is present (no `#name` on this page), **user phone required (E.164)** — not a Treena DID — account-level retain checkbox default off. Copy: **name lives in account settings after signup.** Name is collected on `/start` after checkout. Sign in with Google / Sign in with Apple present. Password not sent to Stripe. Stripe Customer at checkout (env-driven live/TEST). Directory index: `public/account/index.html` (`/account/`). |
| `/pay.html` | `public/pay.html` | shipped | Confirms selected plan (price + minutes + overage). Pay redirects to Stripe Checkout (live when `sk_live_` is set; TEST copy only if `sk_test_`). No trial. Secret is not in the page. Directory index: `public/pay/index.html` (`/pay/`). |
| `/start.html` | `public/start.html` | shipped | Post-pay name gate after `GET /api/session` verifies a paid Checkout Session. If Stripe Customer.name is missing, required name form (not on `/account`). Copy: **name lives in account settings after signup.** Name → `POST /api/account` → Stripe Customer.name → HMAC sync `first_name` + `prefs.full_name`. Then `/dashboard`. Text Treena opens `sms:+12138653024`. Directory index: `public/start/index.html` (`/start/`). |
| `/dashboard.html` | `public/dashboard.html` | sot-ready | Present on Pages GET `/dashboard`. Cap has not GO’d product-live. Sections after name: usage (minutes + call count + Stripe/Fly reset date when verified), billing (TEST badge only when `sk_test_`; period/renewal dates from Stripe only; Manage billing via Customer Portal; cancel at period end), account settings (name + user phone + retain, default off), Linq L1 threads, agent observability (`call_report` / transcript when retained). Copy: **name lives in account settings after signup.** HMAC GET Fly `/accounts/dashboard`. Empty thread/obs arrays if `ACCOUNT_SYNC_SECRET` is missing. Directory index: `public/dashboard/index.html` (`/dashboard/`). |

Order: landing → `/login` or `/account` (Google/Apple or email+password) + pay (Stripe env-driven, no trial) → `/start` name (if missing) → `/dashboard`. A signed-in Treena account hitting `/` or `/login` is routed to `/dashboard`, not the landing. Text Treena is `sms:+12138653024` (shared bot).

Locked plans only:

1. Personal — $20/mo · 30 connected min · $0.15/min overage
2. Plus — $40/mo · 90 min · $0.12/min

No trial. No free forever. No annual/team/enterprise.

Pages Functions: `POST /api/checkout`, `GET /api/session`, `GET /api/config`, `POST /api/webhook`, `GET/POST /api/account`, `GET /api/dashboard`, `GET /api/billing`, `POST /api/billing/portal`, `POST /api/billing/cancel`, `GET/POST /api/auth/*` (Google + Apple). Checkout mode follows `STRIPE_SECRET_KEY` (`sk_test_` or `sk_live_`). `POST /api/webhook` gates on `STRIPE_WEBHOOK_SECRET` (unset → 503; do not invent). On `checkout.session.completed`, `customer.updated`, subscription updated/deleted, and post-pay name / settings save, Pages Functions HMAC-POST signed JSON to Fly `POST /accounts/sync` (`ACCOUNT_SYNC_SECRET`). Dashboard HMAC-GETs Fly `GET /accounts/dashboard?phone=` (HMAC over the E.164 **user** phone query value). Fly is the sole writer of `users`. This website does not open `NEON_DATABASE_URL`. Verifier: `npm run verify` (`scripts/verify-paywall.mjs`). CI runs that command (mock Stripe / mock Fly). Optional `VERIFY_LIVE_ORIGIN` GETs live `/` for SHA + iMessage subhead. Do not claim Fly sync live. Cap has not GO’d dashboard product-live. Stripe live flip is Cap GO (env-driven).

Out of scope: KYC, magic-link auth backend, Fly deploy / live Machines, Linq live messaging, L1 redial. Account form still does not send password to Stripe. Google + Apple sign-up is present; Pages secrets are installed. Google consent External (test users/publish) is product/ops. Name is not on signup — it is required on `/start` after pay, and copy on `/account`, `/start`, and `/dashboard` says name lives in account settings after signup. Neon writes from this website are out of scope. Hangup wipe, Fly accounts, and `verify-accounts` live in `natecl/call-agent`. Do not invent a per-user Treena DID. Do not invent `STRIPE_WEBHOOK_SECRET`.

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

**shipped.** Present in this repo and on the live Pages host in a form that already satisfies that capability's SoT intent. TRE-22 unfroze home; Pixel owns restyle. This map does not invent a home redesign. Keep “Your phone call agent, right in iMessage.” A dark placeholder page is not the product landing.

**sot-ready.** Astra SoT specifies it in the attached overall-page frame, in `relay-agent-handoff.md`, in the Nathan-via-Cap brand lock this session, or in more than one of those. Approved design exists. Cap has not GO’d a product-live claim. Dashboard HTML present on Pages GET `/dashboard` stays sot-ready until Cap GO. Fly sync stays sot-ready — do not claim Fly sync live.

**not-started.** Not implemented. SoT does not specify it enough to build without inventing.

## Host today

The live consumer URLs are `https://usetreena.com` and `https://www.usetreena.com`, measured by GET this session. The Pages preview `https://call-agent-7qt.pages.dev/` still serves the same HTML.

The file that ships on that host is `public/index.html`. `README.md` is in the repo and is not served.

`public/index.html` is 8760 bytes. The title is `Treena — You text. We call. Life moves.` The h1 is "You text. We call. Life moves." The subhead includes “Your phone call agent, right in iMessage.” The page is the Treena product landing on Cloudflare Pages project `call-agent`. It is not the old 997-byte dark placeholder. The HTML contains Treena, "You text", "Watch a call", "Life moves", and the iMessage line. It does not contain a `call-agent` h1 or TBD product-name copy, measured by reading the file this session.

Live `/` SHA-256 is the repo file `public/index.html`: `8c84c3b942ec59982fcbb3836307a44f67ee67054845fce0ab273bd7a14a7e45` (~8760 B). The production host still serves the previous landing until a Pages deploy (this agent must not deploy). Optional `VERIFY_LIVE_ORIGIN` GET `/` re-checks that SHA and the iMessage subhead after ops deploys.

A GET of `https://call-agent-7qt.pages.dev/anything-missing` returns HTTP 200 and that same HTML, measured. `public/404.html` is absent.

The public brand is Treena, measured from Nathan via Cap this session and from the live HTML.

The consumer home domain is `usetreena.com`. Apex and `www` are live on Cloudflare Pages project `call-agent`, measured. HTTPS GET of `https://usetreena.com` and `https://www.usetreena.com` returns HTTP 200 and the Treena product landing. Repo `public/index.html` is 8760 bytes after this change.

The product landing is present. TRE-22 unfroze home. Pixel owns restyle. Correcting this map is not a redesign. Keep the iMessage subhead.

The SoT landing is static HTML with no build step. Entry files in SoT are `index.html`, `style.css`, `app.js`, and `assets/`, measured from `relay-agent-handoff.md`. This repo has `public/index.html`, `public/style.css`, `public/app.js`, and `public/assets/`, measured by listing the workspace this session. The live HTML links `style.css` and `app.js`.

The only file under `docs/` is this map. `AGENTS.md` at repo root points Cloud Agents at this map and `npm run verify`. `relay-agent-handoff.md` is not in this git tree, measured. There are no Pixel files in git.

## Capability registry

The Capability registry is a lookup table of landing capabilities. Each row is one capability. Columns are id, area, purpose, sot, repo, live, status, and evidence.

| id | area | purpose | sot | repo | live | status | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| host-product-landing | host | A visitor at the consumer URL sees the Treena product landing. | none | `public/index.html` is 8760 bytes. Title is `Treena — You text. We call. Life moves.` Subhead includes “Your phone call agent, right in iMessage.” Nav, hero, demo, use-case band, and CTAs are present. It links `style.css`, `app.js`, and `imessage.js`. Text Treena is `sms:+12138653024`. | `https://usetreena.com` still serves the previous landing until Pages deploy (agents must not deploy). SHA-256 of this repo file: `8c84c3b942ec59982fcbb3836307a44f67ee67054845fce0ab273bd7a14a7e45`. | shipped | measured. TRE-22 unfroze home. HTML contains Treena, "You text", "Watch a call", "Life moves", and the iMessage line. It does not contain a `call-agent` h1 or TBD product-name copy. |
| sot-static-entry | host | The SoT landing is static HTML with no build step. | Entry files are `index.html`, `style.css`, `app.js`, and `assets/`. | This repo has `public/index.html`, `public/style.css`, `public/app.js`, and `public/assets/`. | The live host serves that landing HTML and those linked files. | shipped | measured. `relay-agent-handoff.md` names those entry files. A workspace listing has those files. Live HTML links `style.css` and `app.js`. |
| domain-usetreena | host | The consumer home domain is `usetreena.com`. | Apex ALIAS and www CNAME point at `call-agent-7qt.pages.dev` on Cloudflare Pages project `call-agent`. | This repo has no DNS config. | `https://usetreena.com` and `https://www.usetreena.com` return HTTP 200 and the Treena product landing. | shipped | measured. GET of both hostnames previously. www CNAME is `call-agent-7qt.pages.dev`. Repo `public/index.html` SHA-256 `8c84c3b942ec59982fcbb3836307a44f67ee67054845fce0ab273bd7a14a7e45`. |
| brand-public-treena | brand | The public brand is Treena. | Public brand is Treena. Locked. | `README.md` names Treena. `public/index.html` wordmark, title, CTAs, and iMessage contact are Treena. | The live page uses the same Treena copy. There is no TBD product-name copy. | shipped | measured. Nathan via Cap this session locked Treena. Live HTML contains Treena and does not say product name is TBD. |
| brand-relay-codename | brand | Relay is internal and legacy SoT. | Relay is the internal and legacy SoT codename. SoT mock wordmark lettering and "Text Relay" CTA copy may still use Relay-family strings. Those strings are not the public brand. | absent as a live name. Public CTAs say "Text Treena". | absent as a live name | shipped | measured. Nathan via Cap this session. Live HTML and `public/index.html` do not contain "Text Relay" or a `call-agent` h1. |
| brand-sot-wordmark | brand | The SoT landing shows a left nav wordmark. | The overall-page frame shows a left wordmark. The public shipping wordmark is Treena. Exact letter forms in that PNG may still be Relay-family. | `public/index.html` left nav wordmark is the text Treena. | The live page shows the same Treena wordmark. | shipped | measured. The attached frame shows a left wordmark. Live HTML wordmark is Treena. Exact PNG letter spelling is inferred. |
| nav-in-page-links | nav | A visitor uses the in-page labels "How it works" and "What it can do". | Those two labels sit in the nav. | `public/index.html` nav has those two labels. | The live page has the same labels. | shipped | measured. The attached frame shows the two labels. Live HTML has them. |
| nav-link-targets | nav | A visitor who follows those labels reaches the sections they name. | none | "How it works" is `href="#how-it-works"`. "What it can do" is `href="#use-cases"`. `public/app.js` scrolls How it works to the demo. | The live page has the same hrefs and script. | shipped | measured. Those ids and hrefs are in `public/index.html`. `public/app.js` binds How it works to the demo. |
| nav-primary-cta | nav | A visitor sees a right primary button labeled "Text Treena". | The SoT frame button is solid blue with white type and a pill shape. SoT copy is "Text Relay". The public brand is Treena. | `public/index.html` right primary button is "Text Treena". | The live page has the same button. | shipped | measured. The attached frame shows the pill button. Live copy is Text Treena per Nathan via Cap. |
| hero-headline | hero | A visitor reads "You text. We call. Life moves." | A yellow underline accent sits on "moves." | `public/index.html` h1 is that headline with an underline SVG on "moves." | The live page has the same headline. | shipped | measured. The attached frame shows the headline and the underline. Live HTML and `npm run verify` check "You text." |
| hero-subhead | hero | A visitor reads "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage." | That subhead sits under the headline. The product start is iMessage. | `public/index.html` has that subhead under the h1. | The live page has the same subhead. | shipped | measured. The attached frame shows the subhead. Live HTML contains it. `relay-agent-handoff.md` states that start is iMessage. |
| hero-primary-cta | hero | A visitor sees a solid blue "Text Treena" button under the subhead. | The SoT filled button uses "Text Relay". The public brand is Treena. | `public/index.html` hero actions include a filled "Text Treena" button. | The live page has the same button. | shipped | measured. The attached frame shows two hero CTAs. Live filled copy is Text Treena. |
| hero-secondary-cta | hero | A visitor sees an outline "Watch a call" button with a play glyph. | The button is outline style with a play glyph. The outline button sits beside the filled CTA. | `public/index.html` has `#watch-call` with a play glyph and the label "Watch a call". | The live page has the same button. | shipped | measured. The attached frame shows the outline button and glyph. `npm run verify` checks "Watch a call". |
| hero-watch-call-target | hero | A visitor who chooses "Watch a call" reaches a destination that button names. | none | `public/app.js` scrolls to the demo and replays it. | The live page loads that script. | shipped | measured. `$('#watch-call')` in `public/app.js` calls `watchDemo()`. |
| phone-demo | phone-demo | A visitor sees one phone demo that pairs iMessage bubbles with matching iPhone frames. | The stage around the devices is pearl-gray and rounded. The call surface is dark. An iPhone iMessage thread sits on the left. A call UI sits on the right with a handset, Publix, a timer, a waveform, and a red end-call control. A hand-drawn cord connects them. The visitor texts Publix about oat milk stock. The agent places the call. The thread later shows in stock, aisle 6. This is the only functional demo. | `public/index.html` has that demo pair, cord, Publix oat milk thread, and call UI. | The live page has the same demo. | shipped | measured. Live HTML contains Publix, aisle 6, and the iMessage plus call pair. |
| phone-demo-annotations | phone-demo | A visitor reads "You text what you need." and "We call. You get the answer." plus the caption "Illustrative demo". | The demo stage has those margin notes and that caption. | `public/index.html` has those two ink notes. The demo section aria-label starts with "Illustrative demo". | The live page has the same notes and label. | shipped | measured. Those strings are in `public/index.html`. |
| phone-demo-live-captions | phone-demo | A visitor reads live captions outside the call surface. | Live captions sit outside the call surface. | `public/index.html` has `.live-caption` outside the call devices. | The live page has the same caption. | shipped | measured. `relay-agent-handoff.md` places live captions outside the call surface. Live HTML has `.live-caption`. |
| phone-demo-result-imessage | phone-demo | A visitor sees the demo result return to iMessage. | After the call, the result returns to iMessage. | `public/index.html` shows the answer bubble in the iMessage thread. `public/app.js` later sets the caption to "Answer sent to iMessage". | The live page has the same thread and script. | shipped | measured. `relay-agent-handoff.md` states that the result returns to iMessage. Repo HTML and `public/app.js` do that. |
| use-cases-headline | use-cases | A visitor reads "One text. One less thing to do." and "The everyday calls, handled." | Those lines are the band headline and subhead under the demo. | `public/index.html` has those two lines in `#use-cases`. | The live page has the same lines. | shipped | measured. The attached frame shows both lines. Live HTML contains them. |
| use-case-dinner | use-cases | A visitor sees the dinner scene "A table for two." | The art is a hand-drawn table and flower. Peach highlight sits on "two". Subcopy is "Dinner plans, without the phone call." | `public/app.js` dinner scene uses `A table` / `for two.` and that caption. Art is `public/assets/dining-retina-art.png`. | The live page loads that script and asset. | shipped | measured. `public/app.js` names that scene. The attached frame shows this first illustrated scene. |
| use-case-haircut | use-cases | The use-case carousel includes a haircut scene. | `relay-agent-handoff.md` names haircut. The attached crop does not show art, headline, or subcopy. | `public/app.js` has Haircuts / `off the top.` Art is `public/assets/haircut-yellow-art.png`. | The live page loads that script and asset. | shipped | measured. `relay-agent-handoff.md` lists haircut. `public/app.js` and `public/assets/` include it. |
| use-case-stock | use-cases | The use-case carousel includes a stock scene. | `relay-agent-handoff.md` names stock. The attached crop does not show art, headline, or subcopy. | `public/app.js` has Store stock / `make the trip.` Art is `public/assets/stock-retina-art.png`. | The live page loads that script and asset. | shipped | measured. `relay-agent-handoff.md` lists stock. `public/app.js` and `public/assets/` include it. |
| use-case-rescheduling | use-cases | The use-case carousel includes a rescheduling scene. | `relay-agent-handoff.md` names rescheduling. The attached crop does not show art, headline, or subcopy. | `public/app.js` has Rescheduling / `better time`. Art is `public/assets/reschedule-retina-art.png`. | The live page loads that script and asset. | shipped | measured. `relay-agent-handoff.md` lists rescheduling. `public/app.js` and `public/assets/` include it. |
| use-case-business-hours | use-cases | The use-case carousel includes a business hours scene. | `relay-agent-handoff.md` names business hours. The attached crop does not show art, headline, or subcopy. | `public/app.js` has Business hours / `Still open?` Art is `public/assets/hours-retina-art.png`. | The live page loads that script and asset. | shipped | measured. `relay-agent-handoff.md` lists business hours. `public/app.js` and `public/assets/` include it. |
| use-case-cycle | use-cases | A visitor sees a carousel of five illustrated use cases in the lower band. | The band is a carousel of dinner, haircut, stock, rescheduling, and business hours. Cycle timing is about 2.5s with smooth transitions. It is not a second chat or call demo. | `public/app.js` cycles those five scenes every 2500ms. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names the five-scene carousel and the 2.5s timing. `resetCycle()` uses 2500. |
| motion-viewport-playback | motion | Viewport playback advances one demo at a time. | `relay-agent-handoff.md` names viewport-aware playback. One demo advances at a time. | `public/app.js` `syncPlaybackFocus()` gives playback to the demo or the use-case band, not both. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names viewport-aware playback and one-at-a-time advance. `public/app.js` implements that focus. TRE-22 unfroze home; Pixel owns restyle. |
| motion-reduced-motion | motion | A visitor who prefers reduced motion sees a static path. | `relay-agent-handoff.md` names a reduced-motion static path. | `public/app.js` and `public/style.css` read `prefers-reduced-motion`. | The live page loads those files. | shipped | measured. `relay-agent-handoff.md` names the reduced-motion path. Repo files implement it. |
| motion-scene-transitions | motion | A visitor sees scene cycle transitions in the use-case band. | `relay-agent-handoff.md` names scene cycle and transitions. | `public/app.js` `showScene()` adds `scene-enter` / `scene-exit`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names scene cycle and transitions. `public/app.js` has those classes. |
| motion-preload | motion | Autoplay waits until images and fonts are loaded. | `relay-agent-handoff.md` names image and font load before autoplay. | `public/app.js` waits on `document.fonts.ready` and image `decode()` before `resetCycle()`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names that preload. `public/app.js` does that wait. |
| motion-settle-scene | motion | Landing motion settles the scene before the next advance. | `relay-agent-handoff.md` names `settleScene()`. Resize and visibility also settle. | `public/app.js` defines `settleScene()`. ResizeObserver and visibility change call it. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names `settleScene()` and resize and visibility settle. `public/app.js` has those calls. |
| motion-transition-ids | motion | Scene transitions use named transition IDs. | `relay-agent-handoff.md` names transition IDs. | `public/app.js` has `transitionId`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names transition IDs. `public/app.js` declares `transitionId`. |
| motion-use-case-timing | motion | The use-case carousel cycles at about 2.5s. | Cycle timing is about 2.5s with smooth transitions. | `public/app.js` `setInterval(..., 2500)`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names that timing. `public/app.js` uses 2500. |
| cta-message-url-stub | cta-integration | A visitor who uses a CTA follows the shared Treena sms URL. | SoT used empty `RELAY_MESSAGE_URL` as a coming-soon stub. Cap 2026-09-13 published Linq sandbox DID `+12138653024`. | `public/imessage.js` + `functions/_lib/imessage.js` default `+12138653024`. Env `PUBLIC_TREENA_IMESSAGE_E164` or `LINQ_FROM_E164` can swap. `GET /api/config` exposes `imessage`. | Live host still has the previous HTML until this deploys. | shipped | measured. Cap-confirmed sandbox DID. Ops may swap via env. |
| cta-coming-soon-dialog | cta-integration | Coming-soon copy is gone. Dialog is fallback only if the sms URL is empty. | Empty URL used to open coming soon. Number is now published. | `#contact-dialog` copy is “Text Treena at +12138653024.” Primary CTAs are `sms:+12138653024`. | Previous live host still said coming soon until this deploys. | shipped | measured. Cap published the number. |
| cta-shared-imessage | cta-integration | Sitewide shared Treena iMessage bot is `+12138653024`. | Cap/ops: Linq sandbox `LINQ_FROM_E164` / L1 prove. Ride until ~Sep 18. | One source of truth in `imessage.js` / `_lib/imessage.js`. Nav, hero, start, inner chrome. | Not live until Pages deploy. | shipped | measured. Not a per-user DID. |
| auth-login-page | auth | `/login` is a real page, not homepage fallthrough. | Cap wave 2. | `public/login.html`, `public/login/index.html`, `public/_redirects` `/login` → `/login.html` 200. | Not live until Pages deploy. | shipped | measured. Title is Log in — Treena. Not the home h1. |
| auth-google-apple | auth | Google OAuth + Apple sign-up are present. | Nathan via Cap: Google + Apple. Apple Services ID `com.usetreena.signin`. | `/login` + `/account` buttons. `GET /api/auth/google` and `/api/auth/apple`. Callbacks `https://usetreena.com/api/auth/google/callback` and `https://usetreena.com/api/auth/apple/callback`. Missing ops keys are named (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `AUTH_SESSION_SECRET`). `APPLE_CLIENT_ID` defaults to `com.usetreena.signin`. | Ops installed Pages secrets. Google consent External (test users/publish) is product/ops. | shipped | measured. Buttons present. Callbacks env-gated. www host pins to apex. |
| account-shared-bot-user-phone | account | One shared Treena bot number; each account stores the user’s own phone. | Cap read. | Stripe Customer `phone` / Fly `phone` is the user E.164. Treena DID is not per-user. Phone hint says it is the number they’ll text from. | sot-ready Fly writer. | shipped | measured. No per-user Treena DID in this schema. |
| cta-no-backend | cta-integration | Home still has no signup form or calling API. Text Treena opens iMessage. | `relay-agent-handoff.md` states that the landing has no calling backend. | Home Text Treena is `sms:+12138653024`. Stripe checkout is other routes. `/login` and `/account` hold Google/Apple. | Live home still the previous HTML until deploy. | shipped | measured. Home has no signup form. |
| account-fly-sync | account | Website POSTs signed TRE-20 account JSON to Fly `POST /accounts/sync`. Fly is the sole writer of `users`. Web does not write Neon. | Nathan lock sync B. call-agent `docs/accounts.md`. | `functions/_lib/sync.js` HMAC `ACCOUNT_SYNC_SECRET` (`X-Account-Sync-Signature: sha256=<hex>`). URL is `CALL_AGENT_SYNC_URL` or `PUBLIC_BASE_URL/accounts/sync`. Map: Customer `phone` → `phone`; optional `name` → `first_name` (first token) + `prefs.full_name` (signup does not collect name; post-pay `/start` does); `id` → `stripe_customer_id`; `metadata[plan]` → `plan`; `metadata[minutes]` → `minutes_included`; `retain_after_call=on` → `retain_call_artifacts`. `minutes_used` is omitted (Fly omit-preserve; explicit `0` would write 0). Triggers: `checkout.session.completed`, `customer.updated`, `customer.subscription.updated` / `deleted`, `POST /api/account` (Stripe first, then Fly). Retry 5xx. | Do not claim Fly sync live. Writer is not product-live. | sot-ready | measured. `npm run verify` / `verify-paywall` TEST path. No Neon. Fly accounts live in `natecl/call-agent`. |
| post-pay-name | account | After checkout, `/start` requires a name before dashboard if Stripe Customer.name / first_name is missing. Copy on `/account`, `/start`, and `/dashboard` says name lives in account settings after signup. | Cap accounts climb PR2. Both: collect name on `/start` and settings copy. | `public/start.html` `#start-name` / `#name`. `POST /api/account` writes Stripe Customer.name then HMAC sync. `/account.html` has no `#name`. Copy: “Name lives in account settings after signup.” | GET `/start` serves the name page. `/account` has no `#name`. Fly sync of that name stays sot-ready. | shipped | measured. `npm run verify`. Live GET `/start` has `#name`. Settings copy is on account, start, and dashboard. |
| account-fly-dashboard | account | Website HMAC-GETs Fly `GET /accounts/dashboard?phone=`. Web does not open Neon or R2. | call-agent PR #35. | `functions/_lib/sync.js` `getAccountDashboard`. HMAC over the E.164 phone query value (`X-Account-Sync-Signature`). URL derived from sync origin. Missing `ACCOUNT_SYNC_SECRET` returns empty `threads` / `calls`. | HTML may already be on Pages GET `/dashboard`. Cap not GO for product-live. Do not claim Fly-backed dashboard live. | sot-ready | measured. `npm run verify` mocked Fly GET. Present on Pages. Cap has not GO’d. |
| dashboard-usage | dashboard | Dashboard shows minutes included / used and call count. | Cap accounts climb PR2. | `public/dashboard.html` `#usage`. Used stays 0 until minutes ledger ships. Copy: usage totals update after calls. Name lives in account settings after signup. | Present on Pages GET `/dashboard`. Cap not GO for product-live. | sot-ready | measured. HTML on Pages. Cap has not GO’d. |
| dashboard-billing-test | dashboard | Dashboard billing follows Stripe env mode (TEST badge when `sk_test_`; live when `sk_live_`). | Cap GO 2026-09-14 live keys. | `functions/api/billing.js` + dashboard `#billing` `.test-badge` (`data-stripe-test-only`). Accepts `cs_live_` with `sk_live_`. | Present on Pages GET `/dashboard`. Cap not GO for product-live. Live keys installed; this agent must not deploy. | sot-ready | measured. Env-driven Stripe path. HTML on Pages. Cap has not GO’d dashboard product-live. |
| dashboard-billing-period | dashboard | Billing-period reset/renewal dates come from Stripe (and Fly if present). Never fictional. | Cap dashboard backend order. | `functions/_lib/billing.js` `periodFromSubscription` reads `current_period_start` / `current_period_end` (or item-level). Null when Stripe omits them. Dashboard rows `#billing [data-period-row]` / `[data-renews-row]` / `[data-reset-row]` stay hidden without a verified ISO. | Not product-live until Cap GO / Pages deploy. | sot-ready | measured. `npm run verify` asserts null dates when Stripe has none. |
| dashboard-billing-portal | dashboard | Manage billing opens Stripe Customer Portal. No raw cards on Treena. | Cap dashboard backend order. | `POST /api/billing/portal` → Stripe `billing_portal/sessions`. Auth + CSRF. Return URL `/dashboard`. | Not product-live until Cap GO / Pages deploy. Portal must be enabled on the Stripe account (ops). | sot-ready | measured. Mock portal URL. Dashboard `#manage-billing`. |
| dashboard-cancel-plan | dashboard | Cancel plan is end-of-period with a real Stripe effective date. CSRF + ownership. | Cap dashboard backend order. | `POST /api/billing/cancel` sets `cancel_at_period_end=true`. Confirm UI on dashboard. Verifier does not hit live Stripe. | Not product-live until Cap GO / Pages deploy. | sot-ready | measured. `npm run verify` mock cancel. No live cancel. |
| dashboard-account-settings | dashboard | Profile/account settings: name, email (readonly), user phone, retain. Phone is the number they text from, not Treena’s shared bot. | Cap dashboard backend order. Name lives in account settings after signup. | `#settings` on `/dashboard`. `GET/POST /api/account` requires checkout session or auth. `saveAccountSettings` writes Stripe then Fly. Rejects `+12138653024` and Telnyx FROM `+12135690899`. | Not product-live until Cap GO / Pages deploy. | sot-ready | measured. `npm run verify` reserved-phone 400. |
| dashboard-retain-persist | dashboard | Privacy retain preference persists (default off) and syncs Fly. | Cap dashboard backend order. Privacy scare line. | Settings `#settings-retain` unchecked by default. POST maps `retain_after_call` → Fly `retain_call_artifacts`. Account signup checkbox remains default off. | sot-ready Fly writer. | sot-ready | measured. Existing settings save → Fly. Dashboard form wires the same POST. |
| logged-in-home-route | auth | If the visitor has a Treena account (session), `/` and `/login` go to `/dashboard`, not the landing. | Nathan product lock via Cap. | `functions/_middleware.js` + `public/app.js` (sessionStorage checkout + `/api/auth/me`). OAuth `finishSession` sends existing subscribers to `/dashboard`. | Not product-live until Pages deploy. | sot-ready | measured. `npm run verify` middleware + `shouldRouteToDashboard`. |
| dashboard-threads | dashboard | Dashboard lists Linq L1 threads. | Cap accounts climb PR2. | `public/dashboard.html` `#threads`. Empty: “No threads yet. Text Treena at +12138653024.” | Present on Pages GET `/dashboard`. Cap not GO for product-live. | sot-ready | measured. HTML on Pages. Cap has not GO’d. |
| dashboard-observability | dashboard | Dashboard shows retained `call_report` / transcript. Default wipe stays empty. | Cap accounts climb PR2. Hangup wipe is call-agent. | `public/dashboard.html` `#observability`. Empty: “Call details weren’t saved. That’s the default. Turn on save in account settings to keep transcripts and reports.” | Present on Pages GET `/dashboard`. Cap not GO for product-live. | sot-ready | measured. HTML on Pages. Cap has not GO’d. |
| visual-system | visual-system | The SoT landing uses a white canvas, bold black Inter headings, blue filled CTAs, a pearl-gray demo stage, cartoonish illustrations, handwritten notes, vector ink arrows, a handset, a cord, and restrained pastels. | The frame has a yellow underline and a peach word highlight. First-session handoff names the typeface Inter and the direction useful, simple, warm, and polished. `relay-agent-handoff.md` names cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved. | `public/style.css` sets `body` background `#fff` and Inter. `public/assets/` has illustration PNGs and `InterVariable.woff2`. | The live host is that light landing, not a dark placeholder. | shipped | measured. Live CSS is white canvas. First-session handoff names Inter. TRE-22 unfroze home; Pixel owns restyle. Keep the iMessage subhead. |
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

The right button label is "Text Treena". It is a solid primary pill, measured. SoT copy was "Text Relay". That string is not the public brand.

The repo and the live host have that nav, measured.

### Hero

The SoT headline is "You text. We call. Life moves." A yellow underline sits on "moves.", measured. The live h1 is that headline, measured.

The SoT subhead is "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage.", measured. `relay-agent-handoff.md` states the same product shape. The visitor texts. The agent calls businesses on their behalf. The start is iMessage, measured from `relay-agent-handoff.md`. The live page has that subhead, measured.

Two CTAs sit under the subhead, measured. The filled button is "Text Treena". The outline button is "Watch a call" with a play glyph.

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

The band is a carousel of those five illustrated scenes, measured from `relay-agent-handoff.md` and from `public/app.js`. Cycle timing is 2500ms. It is not a second functional demo.

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

The shared Treena iMessage number is `+12138653024` (`public/imessage.js`, `functions/_lib/imessage.js`, `PUBLIC_TREENA_IMESSAGE_E164` / `LINQ_FROM_E164`). Text Treena CTAs use `sms:+12138653024`. Dialog copy names that number if the URL is empty. Pricing cards still go to `/account`, not the sms CTA.

No calling backend is connected on the landing. Stripe checkout is other routes (TRE-17, env-driven live). Google + Apple live on `/login` and `/account`. `STRIPE_WEBHOOK_SECRET` unset (webhook gated).

### Visual system

The attached frame is a white canvas, measured. Headings are bold and black. First-session handoff names the typeface Inter. Filled CTAs are blue. The demo stage is pearl-gray.

`relay-agent-handoff.md` names cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved, measured from `relay-agent-handoff.md`.

Pastels are restrained. A yellow underline and a peach word highlight appear in the frame.

First-session handoff names the visual direction useful, simple, warm, and polished.

The live host is a white canvas with Inter and blue filled CTAs, measured from `public/style.css`. It is not a dark scaffold at `#0b0c0f`. TRE-22 unfroze home. Pixel owns restyle.

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

- `public/index.html` is the shipped home page. It is 8760 bytes. SHA-256 is `8c84c3b942ec59982fcbb3836307a44f67ee67054845fce0ab273bd7a14a7e45`. TRE-22 unfroze home. Keep “Your phone call agent, right in iMessage.”
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

- Pixel rebuild
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

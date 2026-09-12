# Landing feature map

This file maps the public landing as a product surface. It is not an implementation plan.

## Account + Stripe TEST paywall

Home is HOLD. `public/index.html` layout, motion, copy, assets, `public/app.js`, hero, demo, and home CTAs are unchanged. Do not add “Text Treena” on home. The existing L2 public CTA on home stays as-is.

TRE-17 supersedes the TRE-6 stub path for **Stripe TEST** only. TRE-20 ties that TEST account to an **E.164 phone**, the selected **plan**, that plan’s **minutes allowance**, and Nathan’s locked **opt-in surface A**: an **account-level** retention setting, **default off**, that **persists with login** (Stripe TEST Customer `metadata[retain_after_call]`). Login and billing minutes may persist either way. Audio, transcripts, and call history are not default-saved. `sk_test_` stays on Cloudflare Pages Functions. The browser never holds the secret. Live Stripe (`sk_live_`), KYC, and a full auth stack are still out of scope. Neon is still out of scope. The TEST account record is a Stripe Customer (`phone` + metadata) + subscription metadata. Live click-through is qa — this map’s TEST rows are verifier-proven, not live-signed-off. This climb does not rewrite `public/privacy.html`. The privacy **page claim is gated / not-shipped** until wipe B matches. Wipe B (write during the call, delete at hangup unless opted in; crash-window leftover accepted) is specified for call-agent TRE-23 — **sot-ready**, not implemented in this repo.

| route | file | status | notes |
| --- | --- | --- | --- |
| `/pricing.html` | `public/pricing.html` | shipped | Headline is Pricing. Two locked plan cards. Card CTAs go to account with `?plan=`. Do not jump to Text Treena from a pricing card. Directory index: `public/pricing/index.html` (`/pricing/`). |
| `/account.html` | `public/account.html` | shipped | Create-account form: email required, **phone required (E.164)**, name optional, **account-level** retain checkbox **unchecked by default** (persists with login). Continue. Account is email + phone + plan + minutes + opt-in. Stripe Customer is created/updated at checkout (TEST) with phone, plan, minutes, and `retain_after_call`. Directory index: `public/account/index.html` (`/account/`). |
| `/pay.html` | `public/pay.html` | shipped | Confirms selected plan (price + minutes + overage), email, E.164 phone, and the **account save setting** (default Don’t save). Pay redirects to Stripe Checkout (TEST). No trial. Secret is not in the page. Directory index: `public/pay/index.html` (`/pay/`). |
| `/start.html` | `public/start.html` | shipped | Post-pay start/done screen. Unlocks only after `GET /api/session` verifies a paid TEST Checkout Session with plan, minutes, and phone. First Text Treena in this flow. Reuses the coming-soon dialog. Directory index: `public/start/index.html` (`/start/`). |

Order: landing (untouched) → account + pay (Stripe TEST, no trial) → then Text Treena.

Locked plans only:

1. Personal — $20/mo · 30 connected min · $0.15/min overage
2. Plus — $40/mo · 90 min · $0.12/min

No trial. No free forever. No annual/team/enterprise.

Pages Functions (TEST): `POST /api/checkout`, `GET /api/session`, `GET /api/config`, `POST /api/webhook`. Checkout requires plan + email + E.164 phone. Customer metadata stores `plan`, `phone`, `minutes`, and `retain_after_call` (`off` unless the user opts in). That flag is the account record that persists with login. Subscription metadata stores the same plus overage. Verifier: `npm run verify` (`scripts/verify-paywall.mjs`). Live host click-through is qa.

Call-agent flag shape (this repo only — hangup delete is a parallel climb on `natecl/call-agent`, do not block TRE-20 on it): Stripe Customer / Checkout Session / subscription `metadata[retain_after_call]` is `off` (default) or `on`. `GET /api/session` returns `retainAfterCall` with the same values. Missing/junk normalizes to `off`.

Out of scope: live Stripe, KYC, password/magic-link auth, Fly / call-agent FastAPI, Linq live messaging, privacy page rewrite, privacy page live claim for default-wipe, hangup wipe / ephemeral audio-transcript behavior in this repo.

## Privacy

TRE-21 scare-line copy is in `public/privacy.html`. This climb does **not** rewrite it. The privacy **page claim is gated / not-shipped** until wipe B matches this account flag. Do **not** claim the privacy page live.

Nathan locked two surfaces. This climb ships **A** only:

1. **Opt-in A** — account-level retention setting, **default off**, persists with login. Shipped on `/account` as `#retain-after-call` and Stripe Customer `metadata[retain_after_call]`.
2. **Wipe B** — write audio/transcript/history during the call, then **delete at hangup** unless the account opted in. Login + billing minute totals may persist either way. Crash-window leftover is accepted. Hangup delete is TRE-23 on `natecl/call-agent`, not this repo. Documented here as **sot-ready** (specified, not implemented here). The privacy **page claim stays gated / not-shipped** until that hangup delete matches this account flag.

| route | file | status | notes |
| --- | --- | --- | --- |
| `/privacy.html` | `public/privacy.html` | sot-ready | TRE-21 scare-line copy is in the repo (headline Privacy; lead “We don’t store anything unless you opt in.”). **Page claim gated / not-shipped until wipe B matches.** This climb does not rewrite the HTML and does not claim the page live. Directory index: `public/privacy/index.html` (`/privacy/`). Same chrome as other inner pages. |

Headline: Privacy. Lead (the scare line): We don’t store anything unless you opt in.

Body, in this order:

1. That includes call audio, transcripts, call history, and extra profile data — off by default. Nothing is saved after a call unless you turn saving on.
2. While a call is happening, audio passes through our providers so the call can run (Telnyx; OpenAI). When you haven’t opted in, we don’t keep it.
3. If you opt in, you choose what to keep (audio, transcript, and/or history). You can turn that off and ask us to delete what was saved.
4. On the call: the other party hears that it’s on behalf of your first name. Treena doesn’t say the product name.
5. We don’t sell your content as ads. We’re not Signal-private or end-to-end encrypted.
6. Contact: privacy@usetreena.com
7. Quieter secondary line (not the scare line): We keep account login and minute totals for billing.

Same chrome: Treena wordmark, nav, Text Treena, footer. Visual SoT is the existing inner-page system (white, Inter, `--blue` `#007AFF`, existing `.page-main`). Treena is a product, never she/her.

Old Ring five-claim blocks (outbound DID, audio for task+debug, AI disclosure, processors, no selling) are superseded. Do not invent extra legal claims: no HIPAA, no “we never store” without the opt-in exception already in this lock, not Signal-private, not end-to-end encrypted.

Home is HOLD. `public/index.html`, `public/app.js`, hero, demo, motion, and the iMessage line are unchanged.

## Status words

This map uses exactly three status values.

**shipped.** Present in this repo and on the live Pages host in a form that already satisfies that capability's SoT intent. Home layout, motion, and copy remain HOLD for restyle. HOLD is not a status word. A dark placeholder page is not the product landing.

**sot-ready.** Astra SoT specifies it in the attached overall-page frame, in `relay-agent-handoff.md`, in the Nathan-via-Cap brand lock this session, or in more than one of those. Approved design exists. It is not implemented in this repo or on the live host.

**not-started.** Not implemented. SoT does not specify it enough to build without inventing.

## Host today

The live consumer URLs are `https://usetreena.com` and `https://www.usetreena.com`, measured by GET this session. The Pages preview `https://call-agent-7qt.pages.dev/` still serves the same HTML.

The file that ships on that host is `public/index.html`. `README.md` is in the repo and is not served.

`public/index.html` is 8610 bytes. The title is `Treena — You text. We call. Life moves.` The h1 is "You text. We call. Life moves." The page is the Treena product landing on Cloudflare Pages project `call-agent`. It is not the old 997-byte dark placeholder. The HTML contains Treena, "You text", "Watch a call", and "Life moves". It does not contain a `call-agent` h1 or TBD product-name copy, measured by reading the file this session.

Live `/` is byte-identical to `public/index.html`. Both have SHA-256 `9256e9774be8eef461c50dc14613e5304fcf9a26208456bf279896c674bc291b`, measured. Apex and `www` return HTTP 200 and that same HTML.

A GET of `https://call-agent-7qt.pages.dev/anything-missing` returns HTTP 200 and that same HTML, measured. `public/404.html` is absent.

The public brand is Treena, measured from Nathan via Cap this session and from the live HTML.

The consumer home domain is `usetreena.com`. Apex and `www` are live on Cloudflare Pages project `call-agent`, measured. HTTPS GET of `https://usetreena.com` and `https://www.usetreena.com` returns HTTP 200 and the same 8610-byte HTML as `public/index.html`.

The product landing is present. Home layout, motion, and copy remain HOLD for restyle. Correcting this map is not a redesign.

The SoT landing is static HTML with no build step. Entry files in SoT are `index.html`, `style.css`, `app.js`, and `assets/`, measured from `relay-agent-handoff.md`. This repo has `public/index.html`, `public/style.css`, `public/app.js`, and `public/assets/`, measured by listing the workspace this session. The live HTML links `style.css` and `app.js`.

The only file under `docs/` is this map. `relay-agent-handoff.md` is not in this git tree, measured. There are no Pixel files in git.

## Capability registry

The Capability registry is a lookup table of landing capabilities. Each row is one capability. Columns are id, area, purpose, sot, repo, live, status, and evidence.

| id | area | purpose | sot | repo | live | status | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| host-product-landing | host | A visitor at the consumer URL sees the Treena product landing. | none | `public/index.html` is 8610 bytes. Title is `Treena — You text. We call. Life moves.` Nav, hero, demo, use-case band, and CTAs are present. It links `style.css` and `app.js`. | `https://usetreena.com`, `https://www.usetreena.com`, and `https://call-agent-7qt.pages.dev/` return the same 8610-byte HTML. | shipped | measured. Live GET `/` SHA-256 matches `public/index.html`. HTML contains Treena, "You text", "Watch a call", and "Life moves". It does not contain a `call-agent` h1 or TBD product-name copy. |
| sot-static-entry | host | The SoT landing is static HTML with no build step. | Entry files are `index.html`, `style.css`, `app.js`, and `assets/`. | This repo has `public/index.html`, `public/style.css`, `public/app.js`, and `public/assets/`. | The live host serves that landing HTML and those linked files. | shipped | measured. `relay-agent-handoff.md` names those entry files. A workspace listing has those files. Live HTML links `style.css` and `app.js`. |
| domain-usetreena | host | The consumer home domain is `usetreena.com`. | Apex ALIAS and www CNAME point at `call-agent-7qt.pages.dev` on Cloudflare Pages project `call-agent`. | This repo has no DNS config. | `https://usetreena.com` and `https://www.usetreena.com` return HTTP 200 and the same 8610-byte HTML as `public/index.html`. | shipped | measured. GET of both hostnames this session. SHA-256 matches `public/index.html`. www CNAME is `call-agent-7qt.pages.dev`. |
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
| motion-viewport-playback | motion | Viewport playback advances one demo at a time. | `relay-agent-handoff.md` names viewport-aware playback. One demo advances at a time. | `public/app.js` `syncPlaybackFocus()` gives playback to the demo or the use-case band, not both. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names viewport-aware playback and one-at-a-time advance. `public/app.js` implements that focus. Home motion remains HOLD for restyle. |
| motion-reduced-motion | motion | A visitor who prefers reduced motion sees a static path. | `relay-agent-handoff.md` names a reduced-motion static path. | `public/app.js` and `public/style.css` read `prefers-reduced-motion`. | The live page loads those files. | shipped | measured. `relay-agent-handoff.md` names the reduced-motion path. Repo files implement it. |
| motion-scene-transitions | motion | A visitor sees scene cycle transitions in the use-case band. | `relay-agent-handoff.md` names scene cycle and transitions. | `public/app.js` `showScene()` adds `scene-enter` / `scene-exit`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names scene cycle and transitions. `public/app.js` has those classes. |
| motion-preload | motion | Autoplay waits until images and fonts are loaded. | `relay-agent-handoff.md` names image and font load before autoplay. | `public/app.js` waits on `document.fonts.ready` and image `decode()` before `resetCycle()`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names that preload. `public/app.js` does that wait. |
| motion-settle-scene | motion | Landing motion settles the scene before the next advance. | `relay-agent-handoff.md` names `settleScene()`. Resize and visibility also settle. | `public/app.js` defines `settleScene()`. ResizeObserver and visibility change call it. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names `settleScene()` and resize and visibility settle. `public/app.js` has those calls. |
| motion-transition-ids | motion | Scene transitions use named transition IDs. | `relay-agent-handoff.md` names transition IDs. | `public/app.js` has `transitionId`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names transition IDs. `public/app.js` declares `transitionId`. |
| motion-use-case-timing | motion | The use-case carousel cycles at about 2.5s. | Cycle timing is about 2.5s with smooth transitions. | `public/app.js` `setInterval(..., 2500)`. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names that timing. `public/app.js` uses 2500. |
| cta-message-url-stub | cta-integration | A visitor who uses a CTA follows `RELAY_MESSAGE_URL` when it is set. | The SoT identifier is `RELAY_MESSAGE_URL`. It is legacy-named. The visitor-facing public brand is Treena. An empty value is the coming-soon path. This map does not invent a second env name. | `public/app.js` sets `RELAY_MESSAGE_URL` to an empty string. | The live page loads that script. | shipped | measured. `relay-agent-handoff.md` names `RELAY_MESSAGE_URL`. `public/app.js` has that identifier, empty. |
| cta-coming-soon-dialog | cta-integration | A visitor sees a coming-soon dialog when the message URL is empty. | Empty `RELAY_MESSAGE_URL` opens a coming-soon dialog. | `public/index.html` has `#contact-dialog`. Copy is "Treena’s number is coming soon." | The live page has the same dialog. | shipped | measured. `relay-agent-handoff.md` names that dialog. Live HTML contains that copy. |
| cta-no-phone-numbers | cta-integration | The landing does not present a product phone number. | `relay-agent-handoff.md` records that phone numbers must not be invented. | `public/index.html` has no product phone number. The dialog says the number is coming soon. | The live landing has the same absence. | shipped | measured. `relay-agent-handoff.md` records that phone numbers must not be invented. Live HTML has none. |
| cta-no-backend | cta-integration | A visitor cannot sign up, start a call, or reach a calling backend from this landing. | `relay-agent-handoff.md` states that the landing has no backend, signup, or calling. | Home has no signup form and no calling API. Text Treena opens the coming-soon dialog. Stripe TEST checkout is other routes (TRE-17 / TRE-20). | The live home has the same absence. | shipped | measured. Live home HTML has no signup form and no calling wiring. |
| account-phone-e164 | account | A personal TEST account is tied to an E.164 phone number. | TRE-20. iMessage start. | `public/account.html` requires `#account-phone`. `functions/_lib/phone.js` normalizes E.164. Checkout writes Stripe Customer `phone` + `metadata[phone]`. `GET /api/session` returns phone. | Live click-through is qa. | shipped | measured. `npm run verify` TEST path. Phone is required on checkout. Invalid numbers are 400. Home is unchanged. |
| account-plan | account | A personal TEST account is tied to Personal ($20 / 30 min) or Plus ($40 / 90 min). | TRE-17 / TRE-20 locked plans. No trial. | Pricing cards pass `?plan=`. Account/pay/start echo the plan. Checkout + subscription metadata store `plan`. | Live click-through is qa. | shipped | measured. `npm run verify` TEST path. Unknown plans are 400. |
| account-minutes | account | A personal TEST account is tied to the selected plan’s minutes allowance. | TRE-20. Personal 30 / Plus 90. Login and billing minutes may persist. | Pay and start show connected minutes. Customer and subscription metadata store `minutes` from the locked plan, not a free-form value. | Live click-through is qa. | shipped | measured. `npm run verify` TEST path. `paidSessionView` returns `minutes` from `PLANS`. |
| account-retain-opt-in | account | Account-level retention setting. Default off. Persists with login (Stripe TEST Customer `metadata[retain_after_call]`). Audio, transcripts, and call history are not default-saved. | Nathan lock surface A. TRE-20. | Account checkbox `#retain-after-call` is unchecked. Checkout writes `metadata[retain_after_call]=off` unless opted in. Existing Customer is updated. `GET /api/session` returns `retainAfterCall`. Pay and start echo the account save setting. | Live click-through is qa. | shipped | measured. `npm run verify` TEST path. Missing/junk values normalize to off. This climb does not implement call-agent wipe. Privacy page claim gated. |
| privacy-default-wipe | privacy | Call path writes audio/transcript/history during the call, then deletes at hangup unless the account opted in. Login and billing minutes may persist. Crash-window leftover accepted. | Nathan lock wipe B. TRE-23 on natecl/call-agent. Privacy page claim gated / not-shipped until this matches. | absent in this repo. No hangup delete. No ephemeral audio-transcript wipe. Flag shape only: Stripe `metadata[retain_after_call]` = `off` \| `on`; `GET /api/session` returns `retainAfterCall`. | Do not claim live. | sot-ready | measured. This repo stops at the account opt-in flag. Call-agent hangup delete is a parallel climb. |
| visual-system | visual-system | The SoT landing uses a white canvas, bold black Inter headings, blue filled CTAs, a pearl-gray demo stage, cartoonish illustrations, handwritten notes, vector ink arrows, a handset, a cord, and restrained pastels. | The frame has a yellow underline and a peach word highlight. First-session handoff names the typeface Inter and the direction useful, simple, warm, and polished. `relay-agent-handoff.md` names cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved. | `public/style.css` sets `body` background `#fff` and Inter. `public/assets/` has illustration PNGs and `InterVariable.woff2`. | The live host is that light landing, not a dark placeholder. | shipped | measured. Live CSS is white canvas. First-session handoff names Inter. Home visual restyle remains HOLD. |
| sot-overall-page-frame | sot-assets | The approved overall-page frame is the composition source for this map. | The attached file is `09-illustrated-use-cases.png`. The PNG is not in git. | absent | absent | sot-ready | measured. The parent task attached the PNG. The workspace file list has no SoT image. |
| sot-handoff-md | sot-assets | `relay-agent-handoff.md` is a source for this map. | That file is measured handoff text from the parent task. It is not in this git tree. | absent | absent | sot-ready | measured. The parent task named that file. A workspace listing has no copy of it. |

## Sections

### Host

The live consumer host is `https://usetreena.com`, with `https://www.usetreena.com` as well, measured. The Pages preview `https://call-agent-7qt.pages.dev/` still serves the same Treena landing HTML.

The SoT landing is static HTML with no build step. Entry files are `index.html`, `style.css`, `app.js`, and `assets/`, measured from `relay-agent-handoff.md`. This repo has those files under `public/`.

The consumer home domain is `usetreena.com`. It is live on Cloudflare Pages project `call-agent`. Status is shipped. Home layout, motion, and copy remain HOLD for restyle.

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

The repo and the live host have that hero, measured. Home copy remains HOLD for restyle.

### Phone demo

The SoT page has one functional demo, measured from the attached frame and `relay-agent-handoff.md`. The live page has that demo, measured.

A pearl-gray rounded stage holds two devices, measured. That stage can remain around the devices. The call surface is dark. `relay-agent-handoff.md` names iMessage bubbles, matching iPhone frames, and a dark call surface.

The left device shows an iPhone iMessage thread with the agent. The right device shows a call UI with Publix, a timer, a waveform, and an end-call control. The call header is "Treena is calling", measured from `public/index.html`. A hand-drawn cord connects the two.

Margin notes read "You text what you need." and "We call. You get the answer." The demo section aria-label starts with "Illustrative demo", measured.

Live captions sit outside the call surface, measured from `relay-agent-handoff.md` and from `.live-caption` in `public/index.html`. The result returns to iMessage, measured from `relay-agent-handoff.md` and from the answer bubble.

The demo narrative in the frame is oat milk stock at Publix, measured. The visitor texts to ask whether oat milk is in stock. The agent places the call. The call UI shows the agent speaking. The thread later shows in stock, aisle 6.

The lower band is not a second chat or call demo, measured from `relay-agent-handoff.md`.

The repo and the live host have that phone demo, measured. Home demo remains HOLD for restyle.

### Use cases

The SoT use-case band sits under the demo, measured. The live page has that band, measured.

The headline is "One text. One less thing to do." The subhead is "The everyday calls, handled.", measured.

The first illustrated scene in the frame is dinner, measured. The headline is "A table for two." Peach highlight sits on "two". Subcopy is "Dinner plans, without the phone call." `public/app.js` ships that scene.

`relay-agent-handoff.md` names four more scenes. The names are haircut, stock, rescheduling, and business hours. Those four are not visible in the attached crop. `public/app.js` and `public/assets/` include those four scenes, measured. This map does not invent crop copy for the PNG.

The band is a carousel of those five illustrated scenes, measured from `relay-agent-handoff.md` and from `public/app.js`. Cycle timing is 2500ms. It is not a second functional demo.

The repo and the live host have that use-case band, measured. Home band remains HOLD for restyle.

### Motion

`relay-agent-handoff.md` names these motion behaviors.

- Load images and fonts before autoplay.
- `settleScene()`.
- Transition IDs.
- Resize and visibility settle.
- A reduced-motion static path.
- Viewport playback. One demo advances at a time.
- Use-case cycle about 2.5s with smooth transitions.

Those behaviors are in this registry. They are implemented in `public/app.js` and `public/style.css`, measured. Home motion remains HOLD for restyle.

### Integration stubs

The SoT identifier is `RELAY_MESSAGE_URL`. It is legacy-named. The visitor-facing public brand is Treena. An empty value opens a coming-soon dialog, measured from `relay-agent-handoff.md`. This map does not invent a second env name. `public/app.js` sets that identifier to an empty string, measured.

`relay-agent-handoff.md` records that phone numbers must not be invented.

No calling backend or signup form is connected on the landing, measured from `relay-agent-handoff.md` and from home HTML. Stripe TEST checkout is other routes (TRE-17 / TRE-20). The coming-soon dialog is present when Text Treena is used and the message URL is empty. Status for that stub control is shipped.

### Visual system

The attached frame is a white canvas, measured. Headings are bold and black. First-session handoff names the typeface Inter. Filled CTAs are blue. The demo stage is pearl-gray.

`relay-agent-handoff.md` names cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved, measured from `relay-agent-handoff.md`.

Pastels are restrained. A yellow underline and a peach word highlight appear in the frame.

First-session handoff names the visual direction useful, simple, warm, and polished.

The live host is a white canvas with Inter and blue filled CTAs, measured from `public/style.css`. It is not a dark scaffold at `#0b0c0f`. Home visual restyle remains HOLD.

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
- Empty `RELAY_MESSAGE_URL` opens a coming-soon dialog. The identifier is SoT and legacy-named. `relay-agent-handoff.md` records that phone numbers must not be invented. No backend, signup, or calling is connected on the landing.
- Motion names are load images and fonts before autoplay, `settleScene()`, transition IDs, resize and visibility settle, a reduced-motion static path, viewport playback with one demo advancing at a time, and use-case cycle about 2.5s with smooth transitions.
- The visual language uses cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved.

**Measured from first-session handoff facts.** Those facts arrived before `relay-agent-handoff.md` was named.

- Headings use Inter. The visual direction is useful, simple, warm, and polished.

**Measured from Nathan via Cap this session.**

- The public brand is Treena. Locked.
- The consumer home domain is `usetreena.com`. Bought.
- Relay is the internal and legacy SoT codename. Treena is the public brand.

**Measured from this repo and the live host.**

- `public/index.html` is the shipped home page. It is 8610 bytes. SHA-256 is `9256e9774be8eef461c50dc14613e5304fcf9a26208456bf279896c674bc291b`.
- `https://usetreena.com`, `https://www.usetreena.com`, and `https://call-agent-7qt.pages.dev/` each return that HTML. Live `/` and an unknown path both return that HTML. HTTP 200.
- The HTML contains Treena, "You text", "Watch a call", and "Life moves". It does not contain a `call-agent` h1 or TBD product-name copy.
- Nav, hero, phone demo, use-case band, CTAs, and `public/app.js` are present. Home layout, motion, and copy remain HOLD for restyle.
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
- Live Stripe (`sk_live_`) / KYC / real charges
- Fly / call-agent FastAPI / Linq live messaging
- Hangup wipe / ephemeral audio-transcript behavior in this repo (TRE-23 is `natecl/call-agent`)
- Privacy page rewrite
- Privacy page live claim for default-wipe (page claim gated / not-shipped until wipe B matches the account flag)
- Cloudflare Git wiring
- Neon
- R2
- Workers other than Pages Functions for Stripe TEST checkout
- The product calling stack in `natecl/call-agent`

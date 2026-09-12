# Landing feature map

This file maps the public landing as a product surface. It is not an implementation plan.

## Design-scoped checkout stubs

Home is HOLD. `public/index.html` layout, motion, copy, assets, `public/app.js`, hero, demo, and home CTAs are unchanged. Do not add “Text Treena” on home. The existing L2 public CTA on home stays as-is.

These routes are **stubs**. No live Stripe, no checkout API, no payment backend, no auth backend.

| route | file | status | notes |
| --- | --- | --- | --- |
| `/pricing.html` | `public/pricing.html` | stub | Headline is Pricing (not coming soon). Two locked plan cards. Card CTAs go to account with `?plan=`. Do not jump to Text Treena from a pricing card. Do not open Stripe. Directory index: `public/pricing/index.html` (`/pricing/`). |
| `/account.html` | `public/account.html` | stub | Create-account form: email required, name optional, Continue. Client-only. No real auth. Then pay with plan preserved. Directory index: `public/account/index.html` (`/account/`). |
| `/pay.html` | `public/pay.html` | stub | Confirms selected plan (price + minutes + overage). Primary Pay $20 / Pay $40 is a stub: no Stripe.js, no keys, no network charge. Muted “Stub — checkout not live”. Directory index: `public/pay/index.html` (`/pay/`). |
| `/start.html` | `public/start.html` | stub | Post-pay start/done screen. First time in this flow the visitor hits Text Treena. Reuses the coming-soon dialog (Treena’s number is coming soon / see how it works). Directory index: `public/start/index.html` (`/start/`). |

Order: landing (untouched) → account + pay → then Text Treena.

Locked plans only:

1. Personal — $20/mo · 30 connected min · $0.15/min overage
2. Plus — $40/mo · 90 min · $0.12/min

No trial. No free forever. No annual/team/enterprise. Privacy page claims stay as they are.

Out of scope for Builder later: live Stripe and real auth.

## Status words

This map uses exactly three status values.

**shipped.** Present in this repo and on the live Pages host in a form that already satisfies that capability's SoT intent. The placeholder host itself can be shipped as infra. Product landing sections are not shipped just because a dark placeholder page exists.

**sot-ready.** Astra SoT specifies it in the attached overall-page frame, in `relay-agent-handoff.md`, in the Nathan-via-Cap brand lock this session, or in more than one of those. Approved design exists. It is not implemented in this repo or on the live host.

**not-started.** Not implemented. SoT does not specify it enough to build without inventing.

## Host today

The live consumer URLs are `https://usetreena.com` and `https://www.usetreena.com`, measured by GET this session. The Pages preview `https://call-agent-7qt.pages.dev/` still serves the same HTML.

The file that ships on that host is `public/index.html`. `README.md` is in the repo and is not served.

`public/index.html` is 997 bytes. The title and the h1 are `call-agent`. The page is dark and centered. The copy states that this URL is infra only and that product name and landing design are TBD. There is no nav, no hero, no phone demo, no use-case band, no CTA, and no JavaScript, measured by reading the file this session.

Live `/` is byte-identical to `public/index.html`. Both have SHA-256 `d3b953ea959750bbc77c2779d62b51edaf5a89145cc191f447299ac8a1d40791`, measured.

A GET of `https://call-agent-7qt.pages.dev/anything-missing` returns HTTP 200 and that same HTML, measured. `public/404.html` is absent.

The public brand is Treena, measured from Nathan via Cap this session. That name is not on the live page. The live HTML still says product name is TBD.

The consumer home domain is `usetreena.com`. Apex and `www` are live on Cloudflare Pages project `call-agent`, measured. HTTPS GET of `https://usetreena.com` and `https://www.usetreena.com` returns HTTP 200 and the same 997-byte HTML as `public/index.html`.

The product landing is absent. The SoT landing is not on this host, measured against the attached frame and `relay-agent-handoff.md`.

The SoT landing is static HTML with no build step. Entry files in SoT are `index.html`, `style.css`, `app.js`, and `assets/`, measured from `relay-agent-handoff.md`. This repo has only `public/index.html` as the page. There is no `style.css`, no `app.js`, and no `assets/` directory, measured by listing the workspace this session.

The only file under `docs/` is this map. There are no SoT assets in git, no motion code, no iMessage URL, and no Pixel files, measured by listing the workspace this session. This repo does not contain `relay-agent-handoff.md`.

## Capability registry

The Capability registry is a lookup table of landing capabilities. Each row is one capability. Columns are id, area, purpose, sot, repo, live, status, and evidence.

| id | area | purpose | sot | repo | live | status | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| host-placeholder-scaffold | host | A visitor at the Pages URL sees a dark, centered call-agent placeholder. | none | `public/index.html` is a dark centered page. Title and h1 are `call-agent`. Copy says this URL is infra only. | `https://call-agent-7qt.pages.dev/` returns the same 997-byte HTML. | shipped | measured. Live GET `/` SHA-256 matches `public/index.html`. |
| sot-static-entry | host | The SoT landing is static HTML with no build step. | Entry files are `index.html`, `style.css`, `app.js`, and `assets/`. | This repo has only `public/index.html`. There is no `style.css`, `app.js`, or `assets/`. | The live host serves that placeholder HTML only. | sot-ready | measured. `relay-agent-handoff.md` names those entry files. A workspace listing has only `public/index.html` as the page. |
| domain-usetreena | host | The consumer home domain is `usetreena.com`. | Apex ALIAS and www CNAME point at `call-agent-7qt.pages.dev` on Cloudflare Pages project `call-agent`. | This repo has no DNS config. | `https://usetreena.com` and `https://www.usetreena.com` return HTTP 200 and the same 997-byte HTML as the Pages preview. | shipped | measured. GET of both hostnames this session. SHA-256 matches `public/index.html`. www CNAME is `call-agent-7qt.pages.dev`. |
| brand-public-treena | brand | The public brand is Treena. | Public brand is Treena. Locked. | `README.md` records Treena as the locked public brand in this map. It still describes the live host as a placeholder. `public/index.html` says product name is TBD. The h1 is `call-agent`. | The live page uses the same TBD copy. There is no Treena wordmark on the host. | sot-ready | measured. Nathan via Cap this session locked Treena. Live HTML still says TBD. |
| brand-relay-codename | brand | Relay is internal and legacy SoT. | Relay is the internal and legacy SoT codename. SoT mock wordmark lettering and "Text Relay" CTA copy may still use Relay-family strings. Those strings are not the public brand. | absent as a live name. SoT CTA copy is not implemented. | absent | sot-ready | measured. Nathan via Cap this session. SoT frame and CTA copy still use Relay-family strings. |
| brand-sot-wordmark | brand | The SoT landing shows a left nav wordmark. | The overall-page frame shows a left wordmark. The public shipping wordmark is Treena. Exact letter forms in that PNG may still be Relay-family. | absent | absent | sot-ready | measured. The attached frame shows a left wordmark. Public shipping wordmark is Treena, measured from Nathan via Cap this session. Exact PNG letter spelling is inferred. |
| nav-in-page-links | nav | A visitor uses the in-page labels "How it works" and "What it can do". | Those two labels sit in the nav. | absent | absent | sot-ready | measured. The attached frame shows the two labels. |
| nav-link-targets | nav | A visitor who follows those labels reaches the sections they name. | none | absent | absent | not-started | inferred. The labels are visible. Target sections are not in the attached crop. |
| nav-primary-cta | nav | A visitor sees a right primary button labeled "Text Relay". | The button is solid blue with white type and a pill shape. That string is SoT copy. The public brand is Treena. | absent | absent | sot-ready | measured. The attached frame shows the pill button. |
| hero-headline | hero | A visitor reads "You text. We call. Life moves." | A yellow underline accent sits on "moves." | absent | absent | sot-ready | measured. The attached frame shows the headline and the underline. |
| hero-subhead | hero | A visitor reads "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage." | That subhead sits under the headline. The product start is iMessage. | absent | absent | sot-ready | measured. The attached frame shows the subhead. `relay-agent-handoff.md` states that start is iMessage. |
| hero-primary-cta | hero | A visitor sees a solid blue "Text Relay" button under the subhead. | The button uses the same SoT CTA copy as the nav button. The public brand is Treena. | absent | absent | sot-ready | measured. The attached frame shows two hero CTAs. The filled one is "Text Relay". |
| hero-secondary-cta | hero | A visitor sees an outline "Watch a call" button with a play glyph. | The button is outline style with a play glyph. The outline button sits beside the filled CTA. | absent | absent | sot-ready | measured. The attached frame shows the outline button and glyph. |
| hero-watch-call-target | hero | A visitor who chooses "Watch a call" reaches a destination that button names. | none | absent | absent | not-started | inferred. The button is in the frame. `relay-agent-handoff.md` does not name what the button opens. |
| phone-demo | phone-demo | A visitor sees one phone demo that pairs iMessage bubbles with matching iPhone frames. | The stage around the devices is pearl-gray and rounded. The call surface is dark. An iPhone iMessage thread sits on the left. A call UI sits on the right with a handset, Publix, a timer, a waveform, and a red end-call control. A hand-drawn cord connects them. The visitor texts Publix about oat milk stock. The agent places the call. The thread later shows in stock, aisle 6. This is the only functional demo. | absent | absent | sot-ready | measured. The attached frame shows the pair, the cord, and the Publix oat milk narrative. `relay-agent-handoff.md` names iMessage bubbles, matching iPhone frames, and a dark call surface. |
| phone-demo-annotations | phone-demo | A visitor reads "You text what you need." and "We call. You get the answer." plus the caption "Illustrative demo". | The demo stage has those margin notes and that caption. | absent | absent | sot-ready | measured. The attached frame shows both notes and the caption. |
| phone-demo-live-captions | phone-demo | A visitor reads live captions outside the call surface. | Live captions sit outside the call surface. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` places live captions outside the call surface. |
| phone-demo-result-imessage | phone-demo | A visitor sees the demo result return to iMessage. | After the call, the result returns to iMessage. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` states that the result returns to iMessage. |
| use-cases-headline | use-cases | A visitor reads "One text. One less thing to do." and "The everyday calls, handled." | Those lines are the band headline and subhead under the demo. | absent | absent | sot-ready | measured. The attached frame shows both lines. |
| use-case-dinner | use-cases | A visitor sees the dinner scene "A table for two." | The art is a hand-drawn table and flower. Peach highlight sits on "two". Subcopy is "Dinner plans, without the phone call." | absent | absent | sot-ready | measured. The attached frame shows this first illustrated scene. |
| use-case-haircut | use-cases | The use-case carousel includes a haircut scene. | `relay-agent-handoff.md` names haircut. The attached crop does not show art, headline, or subcopy. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` lists haircut. The crop does not show it. |
| use-case-stock | use-cases | The use-case carousel includes a stock scene. | `relay-agent-handoff.md` names stock. The attached crop does not show art, headline, or subcopy. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` lists stock. The crop does not show it. |
| use-case-rescheduling | use-cases | The use-case carousel includes a rescheduling scene. | `relay-agent-handoff.md` names rescheduling. The attached crop does not show art, headline, or subcopy. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` lists rescheduling. The crop does not show it. |
| use-case-business-hours | use-cases | The use-case carousel includes a business hours scene. | `relay-agent-handoff.md` names business hours. The attached crop does not show art, headline, or subcopy. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` lists business hours. The crop does not show it. |
| use-case-cycle | use-cases | A visitor sees a carousel of five illustrated use cases in the lower band. | The band is a carousel of dinner, haircut, stock, rescheduling, and business hours. Cycle timing is about 2.5s with smooth transitions. It is not a second chat or call demo. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names the five-scene carousel and the 2.5s timing. |
| motion-viewport-playback | motion | Viewport playback advances one demo at a time. | `relay-agent-handoff.md` names viewport-aware playback. One demo advances at a time. The repo has no motion code. | absent. `public/index.html` has no JavaScript. | absent | sot-ready | measured. `relay-agent-handoff.md` names viewport-aware playback and one-at-a-time advance. The repo has no motion code. |
| motion-reduced-motion | motion | A visitor who prefers reduced motion sees a static path. | `relay-agent-handoff.md` names a reduced-motion static path. The repo has no motion code. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names the reduced-motion path. |
| motion-scene-transitions | motion | A visitor sees scene cycle transitions in the use-case band. | `relay-agent-handoff.md` names scene cycle and transitions. The repo has no motion code. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names scene cycle and transitions. |
| motion-preload | motion | Autoplay waits until images and fonts are loaded. | `relay-agent-handoff.md` names image and font load before autoplay. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names that preload. |
| motion-settle-scene | motion | Landing motion settles the scene before the next advance. | `relay-agent-handoff.md` names `settleScene()`. Resize and visibility also settle. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names `settleScene()` and resize and visibility settle. |
| motion-transition-ids | motion | Scene transitions use named transition IDs. | `relay-agent-handoff.md` names transition IDs. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names transition IDs. |
| motion-use-case-timing | motion | The use-case carousel cycles at about 2.5s. | Cycle timing is about 2.5s with smooth transitions. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names that timing. |
| cta-message-url-stub | cta-integration | A visitor who uses a CTA follows `RELAY_MESSAGE_URL` when it is set. | The SoT identifier is `RELAY_MESSAGE_URL`. It is legacy-named. The visitor-facing public brand is Treena. An empty value is the coming-soon path. This map does not invent a second env name. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names `RELAY_MESSAGE_URL`. |
| cta-coming-soon-dialog | cta-integration | A visitor sees a coming-soon dialog when the message URL is empty. | Empty `RELAY_MESSAGE_URL` opens a coming-soon dialog. | absent | absent | sot-ready | measured. `relay-agent-handoff.md` names that dialog. |
| cta-no-phone-numbers | cta-integration | The landing does not present a product phone number. | `relay-agent-handoff.md` records that phone numbers must not be invented. | `public/index.html` has no phone number. | The placeholder has no phone number. | sot-ready | measured. `relay-agent-handoff.md` records that phone numbers must not be invented. The placeholder also has none. |
| cta-no-backend | cta-integration | A visitor cannot sign up, start a call, or reach a backend from this landing. | `relay-agent-handoff.md` states that the landing has no backend, signup, or calling. | `public/index.html` has no forms, no JS, and no message URL. | The live placeholder has the same absence. | shipped | measured. Live HTML and `public/index.html` contain no signup, calling, or backend wiring. |
| visual-system | visual-system | The SoT landing uses a white canvas, bold black Inter headings, blue filled CTAs, a pearl-gray demo stage, cartoonish illustrations, handwritten notes, vector ink arrows, a handset, a cord, and restrained pastels. | The frame has a yellow underline and a peach word highlight. First-session handoff names the typeface Inter and the direction useful, simple, warm, and polished. `relay-agent-handoff.md` names cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved. | `public/index.html` uses background `#0b0c0f` and light type. There are no illustrations. | The live host is the same dark placeholder. | sot-ready | measured. The attached frame shows the light visual system. First-session handoff names Inter. `relay-agent-handoff.md` names the illustration language and the white bubble. The live host shows the dark scaffold. |
| sot-overall-page-frame | sot-assets | The approved overall-page frame is the composition source for this map. | The attached file is `09-illustrated-use-cases.png`. The PNG is not in git. | absent | absent | sot-ready | measured. The parent task attached the PNG. The workspace file list has no SoT image. |
| sot-handoff-md | sot-assets | `relay-agent-handoff.md` is a source for this map. | That file is measured handoff text from the parent task. It is not in this git tree. | absent | absent | sot-ready | measured. The parent task named that file. A workspace listing has no copy of it. |

## Sections

### Host

The live consumer host is `https://usetreena.com`, with `https://www.usetreena.com` as well, measured. The Pages preview `https://call-agent-7qt.pages.dev/` still serves the same placeholder.

The SoT landing is static HTML with no build step. Entry files are `index.html`, `style.css`, `app.js`, and `assets/`, measured from `relay-agent-handoff.md`. This repo has only `public/index.html`.

The consumer home domain is `usetreena.com`. It is live on Cloudflare Pages project `call-agent`. Status is shipped.

### Nav

The SoT nav has a left wordmark, two in-page labels, and a right primary button, measured from the attached frame.

The public shipping wordmark is Treena, measured from Nathan via Cap this session. The attached frame shows a left wordmark. Exact letter spelling in that PNG may still be Relay-family. That gap is inferred.

The visible labels are "How it works" and "What it can do", measured. Destinations for those labels are not in the attached crop. The inference is that the labels are in-page jumps. Those target sections are not-started.

The right button label is "Text Relay". It is solid blue with white type and a pill shape, measured. That string is SoT copy. It is not the public brand.

The repo and the live host have no nav, measured.

### Hero

The SoT headline is "You text. We call. Life moves." A yellow underline sits on "moves.", measured.

The SoT subhead is "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage.", measured. `relay-agent-handoff.md` states the same product shape. The visitor texts. The agent calls businesses on their behalf. The start is iMessage, measured from `relay-agent-handoff.md`.

Two CTAs sit under the subhead, measured. The filled button is "Text Relay". The outline button is "Watch a call" with a play glyph.

What "Watch a call" opens is not named in the frame or in `relay-agent-handoff.md`. That destination is not-started, inferred.

The repo and the live host have no hero, measured.

### Phone demo

The SoT page has one functional demo, measured from the attached frame and `relay-agent-handoff.md`.

A pearl-gray rounded stage holds two devices, measured. That stage can remain around the devices. The call surface is dark. `relay-agent-handoff.md` names iMessage bubbles, matching iPhone frames, and a dark call surface.

The left device shows an iPhone iMessage thread with the agent. The right device shows a call UI with a handset, the name Publix, a timer, a waveform, and a red end-call control. The call header is a Relay-family "is calling" status. Exact header wording is inferred. A hand-drawn cord connects the two.

Margin notes read "You text what you need." and "We call. You get the answer." The caption is "Illustrative demo", measured.

Live captions sit outside the call surface, measured from `relay-agent-handoff.md`. The result returns to iMessage, measured from `relay-agent-handoff.md`.

The demo narrative in the frame is oat milk stock at Publix, measured. The visitor texts to ask whether oat milk is in stock. The agent places the call. The call UI shows the agent speaking. The thread later shows in stock, aisle 6.

The lower band is not a second chat or call demo, measured from `relay-agent-handoff.md`.

The repo and the live host have no phone demo, measured.

### Use cases

The SoT use-case band sits under the demo, measured.

The headline is "One text. One less thing to do." The subhead is "The everyday calls, handled.", measured.

The first illustrated scene in the frame is dinner, measured. The headline is "A table for two." Peach highlight sits on "two". Subcopy is "Dinner plans, without the phone call." The art is a hand-drawn table and flower.

`relay-agent-handoff.md` names four more scenes. The names are haircut, stock, rescheduling, and business hours. Those four are not visible in the attached crop. This map records the names. Art, headlines, and subcopy for those four scenes are not in the crop.

The band is a carousel of those five illustrated scenes, measured from `relay-agent-handoff.md`. Cycle timing is about 2.5s with smooth transitions. It is not a second functional demo.

The repo and the live host have no use-case band, measured.

### Motion

`relay-agent-handoff.md` names these motion behaviors.

- Load images and fonts before autoplay.
- `settleScene()`.
- Transition IDs.
- Resize and visibility settle.
- A reduced-motion static path.
- Viewport playback. One demo advances at a time.
- Use-case cycle about 2.5s with smooth transitions.

Those behaviors are in this registry. They are not implemented. `public/index.html` has no JavaScript, measured. The live host has no motion, measured.

### Integration stubs

The SoT identifier is `RELAY_MESSAGE_URL`. It is legacy-named. The visitor-facing public brand is Treena. An empty value opens a coming-soon dialog, measured from `relay-agent-handoff.md`. This map does not invent a second env name.

`relay-agent-handoff.md` records that phone numbers must not be invented.

No backend, signup, or calling is connected on the landing, measured from `relay-agent-handoff.md`. That disconnected state is true on the placeholder host, measured. The stubbed CTA control is absent in the repo and on the live host. Status for that stub control is sot-ready.

### Visual system

The attached frame is a white canvas, measured. Headings are bold and black. First-session handoff names the typeface Inter. Filled CTAs are blue. The demo stage is pearl-gray.

`relay-agent-handoff.md` names cartoonish illustrations, handwritten notes, and vector ink arrows, a handset, and a cord. The white answer and caption bubble is approved, measured from `relay-agent-handoff.md`.

Pastels are restrained. A yellow underline and a peach word highlight appear in the frame.

First-session handoff names the visual direction useful, simple, warm, and polished.

The live host is a dark scaffold at `#0b0c0f`, measured. It does not use the SoT visual system.

### Brand

The public brand is Treena, measured from Nathan via Cap this session.

Relay is the internal and legacy SoT codename, measured from Nathan via Cap this session. SoT mock wordmark lettering and "Text Relay" CTA copy may still use Relay-family strings. They are not the public brand.

`public/index.html` still says product name is TBD. The title and the h1 are `call-agent`, measured. The live page is the same placeholder. `README.md` records Treena as the locked public brand in this map and still describes the live host as a placeholder.

The SoT frame shows a left wordmark, measured. The public shipping wordmark is Treena. Exact letter forms in that PNG may still be Relay-family. That spelling gap is inferred.

The consumer home domain is `usetreena.com`. It is live at `https://usetreena.com` and `https://www.usetreena.com`. Status for attach is shipped.

### SoT assets

The overall-page frame is the attached PNG `09-illustrated-use-cases.png`, measured from the parent task. That file is not in this git tree, measured. No other SoT image is in git.

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
- The live host is the placeholder. The product landing is not implemented yet.

**Measured from first-session handoff facts.** Those facts arrived before `relay-agent-handoff.md` was named.

- Headings use Inter. The visual direction is useful, simple, warm, and polished.

**Measured from Nathan via Cap this session.**

- The public brand is Treena. Locked.
- The consumer home domain is `usetreena.com`. Bought.
- Relay is the internal and legacy SoT codename. Treena is the public brand.

**Measured from this repo and the live host.**

- `public/index.html` is the only shipped page. It is 997 bytes. SHA-256 is `d3b953ea959750bbc77c2779d62b51edaf5a89145cc191f447299ac8a1d40791`.
- `https://usetreena.com`, `https://www.usetreena.com`, and `https://call-agent-7qt.pages.dev/` each return that HTML. Live `/` on the preview and an unknown preview path both return that HTML.
- There is no nav, hero, demo, use-case band, CTA, or JavaScript.
- There is no `style.css`, `app.js`, or `assets/` directory.
- No SoT assets are in git. `relay-agent-handoff.md` is not in this git tree. README is not served.

**Inferred.**

- Exact SoT frame wordmark lettering is not proven. The PNG may still show a Relay-family mock. The public shipping wordmark is Treena.
- "How it works" and "What it can do" are visible as nav labels. Their target sections are not in the attached crop. The inference is that those labels are in-page jumps.
- What "Watch a call" opens is unspecified.
- Exact call-header wording on the SoT call UI is not proven. This map records a Relay-family "is calling" status.
- Art and copy for haircut, stock, rescheduling, and business hours are not in the crop. The names are proven. The art is not.

**Guess.**

- This map records no guesses.

## Out of scope

These items are outside this map.

- Pixel rebuild
- Deploy
- Cloudflare Git wiring
- Neon
- R2
- Workers
- The product calling stack in `natecl/call-agent`

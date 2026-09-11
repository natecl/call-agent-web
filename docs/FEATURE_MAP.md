# Landing feature map

This file maps the public landing as a product surface. It is not an implementation plan.

## Status words

This map uses exactly three status values.

**shipped.** Present in this repo and on the live Pages host in a form that already satisfies that capability's SoT intent. The placeholder host itself can be shipped as infra. Product landing sections are not shipped just because a dark placeholder page exists.

**sot-ready.** Astra SoT specifies it in the attached overall-page frame, in the handoff facts in this file, or in both. Approved design exists. It is not implemented in this repo or on the live host.

**not-started.** Not implemented. SoT does not specify it enough to build without inventing.

## Host today

The live URL is `https://call-agent-7qt.pages.dev/`, measured by GET this session.

The file that ships on that host is `public/index.html`. `README.md` is in the repo and is not served.

`public/index.html` is 997 bytes. The title and the h1 are `call-agent`. The page is dark and centered. The copy states that this URL is infra only and that product name and landing design are TBD. There is no nav, no hero, no phone demo, no use-case band, no CTA, and no JavaScript, measured by reading the file this session.

Live `/` is byte-identical to `public/index.html`. Both have SHA-256 `d3b953ea959750bbc77c2779d62b51edaf5a89145cc191f447299ac8a1d40791`, measured.

A GET of `https://call-agent-7qt.pages.dev/anything-missing` returns HTTP 200 and that same HTML, measured. `public/404.html` is absent.

The product landing is absent. The SoT landing is not on this host, measured against the attached frame and the handoff.

The only file under `docs/` is this map. There are no SoT assets in git, no motion code, no iMessage URL, and no Pixel files, measured by listing the workspace this session.

## Capability registry

The Capability registry is a lookup table of landing capabilities. Each row is one capability. Columns are id, area, purpose, sot, repo, live, status, and evidence.

| id | area | purpose | sot | repo | live | status | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| host-placeholder-scaffold | host | A visitor at the Pages URL sees a dark, centered call-agent placeholder. | none | `public/index.html` is a dark centered page. Title and h1 are `call-agent`. Copy says this URL is infra only. | `https://call-agent-7qt.pages.dev/` returns the same 997-byte HTML. | shipped | measured. Live GET `/` SHA-256 matches `public/index.html`. |
| brand-public-unset | brand | A visitor sees no live product name. | Public brand on this host is unset. SoT mock copy is not the live name. | `README.md` states a neutral host with no product brand lock. `public/index.html` says product name is TBD. | The live page uses the same TBD copy. There is no product wordmark. | shipped | measured. README and live HTML both leave the name unset. |
| brand-sot-wordmark | brand | The SoT landing shows a left nav wordmark. | The overall-page frame shows a Relay-family mock wordmark. Relay is the internal SoT codename, not the live public brand. | absent | absent | sot-ready | measured. The attached frame shows a left wordmark. Exact letter spelling is inferred. |
| nav-in-page-links | nav | A visitor uses the in-page labels "How it works" and "What it can do". | Those two labels sit in the nav. | absent | absent | sot-ready | measured. The attached frame shows the two labels. |
| nav-link-targets | nav | A visitor who follows those labels reaches the sections they name. | none | absent | absent | not-started | inferred. The labels are visible. Target sections are not in the attached crop. |
| nav-primary-cta | nav | A visitor sees a right primary button labeled "Text Relay". | The button is solid blue with white type and a pill shape. That string is SoT copy, not a live brand claim. | absent | absent | sot-ready | measured. The attached frame shows the pill button. |
| hero-headline | hero | A visitor reads "You text. We call. Life moves." | A yellow underline accent sits on "moves." | absent | absent | sot-ready | measured. The attached frame shows the headline and the underline. |
| hero-subhead | hero | A visitor reads "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage." | That subhead sits under the headline. The product start is iMessage. | absent | absent | sot-ready | measured. The attached frame shows the subhead. Handoff states that start is iMessage. |
| hero-primary-cta | hero | A visitor sees a solid blue "Text Relay" button under the subhead. | The button uses the same SoT CTA copy as the nav button. | absent | absent | sot-ready | measured. The attached frame shows two hero CTAs. The filled one is "Text Relay". |
| hero-secondary-cta | hero | A visitor sees an outline "Watch a call" button with a play glyph. | The button is outline style with a play glyph. The outline button sits beside the filled CTA. | absent | absent | sot-ready | measured. The attached frame shows the outline button and glyph. |
| hero-watch-call-target | hero | A visitor who chooses "Watch a call" reaches a destination that button names. | none | absent | absent | not-started | inferred. The button is in the frame. The handoff does not name what the button opens. |
| phone-demo | phone-demo | A visitor sees one phone demo that pairs an iMessage thread with a call UI. | The stage is pearl-gray and rounded. An iPhone iMessage thread sits on the left. A call UI sits on the right with a handset, Publix, a timer, a waveform, and a red end-call control. A hand-drawn cord connects them. The visitor texts Publix about oat milk stock. The agent places the call. The thread later shows in stock, aisle 6. This is the only functional demo. | absent | absent | sot-ready | measured. The attached frame shows the pair, the cord, and the Publix oat milk narrative. |
| phone-demo-annotations | phone-demo | A visitor reads "You text what you need." and "We call. You get the answer." plus the caption "Illustrative demo". | The demo stage has those margin notes and that caption. | absent | absent | sot-ready | measured. The attached frame shows both notes and the caption. |
| use-cases-headline | use-cases | A visitor reads "One text. One less thing to do." and "The everyday calls, handled." | Those lines are the band headline and subhead under the demo. | absent | absent | sot-ready | measured. The attached frame shows both lines. |
| use-case-dinner | use-cases | A visitor sees the dinner scene "A table for two." | The art is a hand-drawn table and flower. Peach highlight sits on "two". Subcopy is "Dinner plans, without the phone call." | absent | absent | sot-ready | measured. The attached frame shows this first illustrated scene. |
| use-case-haircut | use-cases | The use-case band includes a haircut scene. | Handoff names haircut. The attached crop does not show art, headline, or subcopy. | absent | absent | sot-ready | measured. Handoff text from the parent task lists haircut. The crop does not show it. |
| use-case-stock | use-cases | The use-case band includes a stock scene. | Handoff names stock. The attached crop does not show art, headline, or subcopy. | absent | absent | sot-ready | measured. Handoff text from the parent task lists stock. The crop does not show it. |
| use-case-rescheduling | use-cases | The use-case band includes a rescheduling scene. | Handoff names rescheduling. The attached crop does not show art, headline, or subcopy. | absent | absent | sot-ready | measured. Handoff text from the parent task lists rescheduling. The crop does not show it. |
| use-case-business-hours | use-cases | The use-case band includes a business hours scene. | Handoff names business hours. The attached crop does not show art, headline, or subcopy. | absent | absent | sot-ready | measured. Handoff text from the parent task lists business hours. The crop does not show it. |
| use-case-cycle | use-cases | A visitor sees illustrated use cases cycle in the lower band. | The band cycles scenes. It is not a second chat or call demo. | absent | absent | sot-ready | measured. Handoff text from the parent task states one functional demo and a band that cycles illustrations. |
| motion-viewport-playback | motion | Landing motion is viewport-aware. | Handoff names viewport-aware playback. The repo has no motion code. | absent. `public/index.html` has no JavaScript. | absent | sot-ready | measured. Handoff text from the parent task names viewport-aware playback. The repo has no motion code. |
| motion-reduced-motion | motion | A visitor who prefers reduced motion sees a static path. | Handoff names a reduced-motion static path. The repo has no motion code. | absent | absent | sot-ready | measured. Handoff text from the parent task names the reduced-motion path. |
| motion-scene-transitions | motion | A visitor sees scene cycle transitions in the use-case band. | Handoff names scene cycle and transitions. The repo has no motion code. | absent | absent | sot-ready | measured. Handoff text from the parent task names scene cycle and transitions. |
| cta-message-url-stub | cta-integration | A visitor who uses a CTA sees a "coming soon" stub, not a live message URL. | The message URL on the CTA is stubbed. | absent | absent | sot-ready | measured. Handoff text from the parent task states that the URL is stubbed. |
| cta-no-backend | cta-integration | A visitor cannot sign up, start a call, or reach a backend from this landing. | Handoff states that the landing has no backend, signup, or calling. | `public/index.html` has no forms, no JS, and no message URL. | The live placeholder has the same absence. | shipped | measured. Live HTML and `public/index.html` contain no signup, calling, or backend wiring. |
| visual-system | visual-system | The SoT landing uses a white canvas, bold black Inter headings, blue filled CTAs, a pearl-gray demo stage, hand-drawn illustrations, and restrained pastels. | The frame has a yellow underline and a peach word highlight. Handoff names the typeface Inter. Handoff also names useful, simple, warm, and polished. | `public/index.html` uses background `#0b0c0f` and light type. There are no illustrations. | The live host is the same dark placeholder. | sot-ready | measured. The attached frame shows the light visual system. Handoff names Inter. The live host shows the dark scaffold. |
| sot-overall-page-frame | sot-assets | The approved overall-page frame is the composition source for this map. | The attached file is `09-illustrated-use-cases.png`. The PNG is not in git. | absent | absent | sot-ready | measured. The parent task attached the PNG. The workspace file list has no SoT image. |

## Sections

### Nav

The SoT nav has a left wordmark, two in-page labels, and a right primary button, measured from the attached frame.

The wordmark is a Relay-family mock. Relay is the internal SoT codename. It is not the live public brand on this host. Exact letter spelling in the frame is inferred.

The visible labels are "How it works" and "What it can do", measured. Destinations for those labels are not in the attached crop. The inference is that the labels are in-page jumps. Those target sections are not-started.

The right button label is "Text Relay". It is solid blue with white type and a pill shape, measured. That string is SoT copy. It is not the live name.

The repo and the live host have no nav, measured.

### Hero

The SoT headline is "You text. We call. Life moves." A yellow underline sits on "moves.", measured.

The SoT subhead is "Book appointments. Ask a store. Skip the hold music. Your phone call agent, right in iMessage.", measured. Handoff states the same product shape. The visitor texts. The agent calls businesses on their behalf. The start is iMessage, measured from handoff.

Two CTAs sit under the subhead, measured. The filled button is "Text Relay". The outline button is "Watch a call" with a play glyph.

What "Watch a call" opens is not named in the frame or the handoff. That destination is not-started, inferred.

The repo and the live host have no hero, measured.

### Phone demo

The SoT page has one functional demo, measured from the attached frame and the handoff.

A pearl-gray rounded stage holds two devices, measured. The left device shows an iPhone iMessage thread with the agent. The right device shows a call UI with a handset, the name Publix, a timer, a waveform, and a red end-call control. The call header is a Relay-family "is calling" status. Exact header wording is inferred. A hand-drawn cord connects the two.

Margin notes read "You text what you need." and "We call. You get the answer." The caption is "Illustrative demo", measured.

The demo narrative in the frame is oat milk stock at Publix, measured. The visitor texts to ask whether oat milk is in stock. The agent places the call. The call UI shows the agent speaking. The thread later shows in stock, aisle 6.

The lower band is not a second chat or call demo, measured from handoff.

The repo and the live host have no phone demo, measured.

### Use cases

The SoT use-case band sits under the demo, measured.

The headline is "One text. One less thing to do." The subhead is "The everyday calls, handled.", measured.

The first illustrated scene in the frame is dinner, measured. The headline is "A table for two." Peach highlight sits on "two". Subcopy is "Dinner plans, without the phone call." The art is a hand-drawn table and flower.

Handoff names four more scenes. The names are haircut, stock, rescheduling, and business hours. Those four are not visible in the attached crop. This map records the names. Art, headlines, and subcopy for those four scenes are not in the crop.

The band cycles those illustrated scenes, measured from handoff. It is not a second functional demo.

The repo and the live host have no use-case band, measured.

### Motion

Handoff names viewport-aware playback and a reduced-motion static path. It also names scene cycle and transitions.

Those behaviors are in this registry. They are not implemented. `public/index.html` has no JavaScript, measured. The live host has no motion, measured.

### Integration stubs

The message URL on the CTA is stubbed. The visitor-facing stub state is "coming soon", measured from handoff.

No backend, signup, or calling is connected on the landing, measured from handoff. That disconnected state is true on the placeholder host, measured. The stubbed CTA control is absent in the repo and on the live host. Status for that stub control is sot-ready.

### Visual system

The attached frame is a white canvas, measured. Headings are bold and black. Handoff names the typeface Inter. Filled CTAs are blue. The demo stage is pearl-gray. Illustrations are hand-drawn lines. Pastels are restrained. A yellow underline and a peach word highlight appear in the frame.

Handoff names that direction useful, simple, warm, and polished, measured from handoff.

The live host is a dark scaffold at `#0b0c0f`, measured. It does not use the SoT visual system.

### Brand

The public brand on this host is unset, measured. README calls the host neutral. `public/index.html` says product name is TBD.

The SoT frame shows a Relay-family mock wordmark and "Text Relay" CTA labels. Those strings stay in this map as SoT copy. They are not the live name.

No live public brand is recorded.

### SoT assets

The overall-page frame is the attached PNG `09-illustrated-use-cases.png`, measured from the parent task. That file is not in this git tree, measured. No other SoT image is in git.

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

**Measured from handoff text in the parent task.**

- The visitor texts. The agent calls businesses on their behalf. The start is iMessage.
- Taglines in SoT are "You text. We call. Life moves.", "One text. One less thing to do.", and "The everyday calls, handled."
- Headings use Inter. The visual direction is useful, simple, warm, and polished.
- There is one functional phone demo. The lower band cycles illustrated use cases. It is not a second demo.
- Scene names are dinner, haircut, stock, rescheduling, and business hours. Only dinner is in the attached crop.
- The CTA message URL is stubbed. No backend, signup, or calling is connected on the landing.
- Motion names are viewport-aware playback and a reduced-motion static path. Handoff also names scene cycle and transitions.
- The live host is the placeholder. The product landing is not implemented yet.

**Measured from this repo and the live host.**

- `public/index.html` is the only shipped page. It is 997 bytes. SHA-256 is `d3b953ea959750bbc77c2779d62b51edaf5a89145cc191f447299ac8a1d40791`.
- Live `/` and an unknown path both return that HTML.
- There is no nav, hero, demo, use-case band, CTA, or JavaScript.
- No SoT assets are in git. README is not served.

**Inferred.**

- Exact public wordmark spelling in the SoT frame is not proven. This map records a Relay-family mock, not a live name.
- "How it works" and "What it can do" are visible as nav labels. Their target sections are not in the attached crop. The inference is that those labels are in-page jumps.
- What "Watch a call" opens is unspecified.
- Exact call-header wording on the SoT call UI is not proven. This map records a Relay-family "is calling" status.

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

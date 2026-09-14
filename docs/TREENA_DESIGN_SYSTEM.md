# Treena visual system

Demo playback refinement: the message thread initializes empty and resets to time zero when viewport playback ownership changes. On entry it holds the empty state for 900ms, then reveals the request, reply, call, and result. Reduced-motion still shows the completed static example.


Homepage CTA refinement: all Text Treena actions use sage fills and dark labels consistently across home and subpages, per the latest visual review. Watch a call has a dark pill surface and visible border. Destinations and click behavior are unchanged.


## Shared motion refinement — sot-ready, not deployed

Cap lock 2026-09-14: header keeps Log in; marketing Text Treena stays `sms:+12138653024` (not `/account?plan=personal`). Visual restyle only. Equalized pricing card padding and 52px plan buttons. Shared motion adds eased hover/press, animated field focus, scroll reveals across every page, and newly visible form-panel entrances. Same-origin page transitions use native View Transitions with arrival-animation fallback. Reduced-motion preferences disable movement. No navigation interception or submission delays. The use-case carousel now holds each result for 3.2 seconds and transitions whole cards/captions together; the legacy word animation and moving underline are removed.


## September 14 visual refinement — sot-ready, not deployed

Removed the visible “Illustrative demo” label and connecting cord. Replaced the old use-case illustrations with warm-white and sage outcome cards. Marketing “Text Treena” stays `sms:+12138653024`. Auth, billing and call behavior are unchanged. This supersedes historical artwork descriptions below; it does not change CTA destinations.


Status: sot-ready. UI-only rebrand in the working tree; no deployment.

## Direction

Soft, friendly, capable. The primary reference is [Meta Muse](https://ai.meta.com/muse/): spacious composition, rounded geometric typography, deliberate hierarchy, and product proof. Treena keeps its own ink and sage identity. [Orchid](https://orchid.ai/) informs native-message presentation; [treena.app](https://www.treena.app/) informs product-first explanation, not product claims.

The supplied [Refero Styles](https://styles.refero.design/), [Space](https://spacefs.com/), [beUI](https://beui.dev/), [Transitions.dev](https://transitions.dev/), [Beautiful UI](https://www.beautifului.dev/), [Rare UI](https://www.rareui.com/) and [shadcn/ui](https://ui.shadcn.com/) were reviewed as component/motion references. The combined Rare UI/shadcn link was treated as two sites. The libraries.dev/gooey page could not be retrieved. No third-party component code or runtime dependency was added: this remains the existing static site.

## Source of truth

`public/treena-theme.css` is loaded after legacy layout CSS on every HTML page. It holds shared tokens, buttons, navigation, forms, dialogs, page treatments, responsive rules, and native-device styling. This explicit final presentation layer keeps existing route and form contracts intact.

Manrope 400, 500 and 600 are self-hosted in `public/assets/` with the OFL license. No runtime font provider is needed. `treena-mark.svg` is the waveform signature; `treena-icon.svg` is the sage contact avatar and favicon.

| Role | Value |
| --- | --- |
| Page | `#141614` |
| Surface | `#1B1E1B` |
| Hover | `#252925` |
| Text | `#F5F3EC` |
| Secondary | `#D8D8D0` |
| Muted | `#969B94` |
| Sage | `#A9C39D` |
| Sage hover | `#BED2B5` |
| On sage | `#172017` |
| Border | `#2A2E2A` |
| Native iMessage | `#0A84FF` |

Headline weights stay at 500. Desktop display is 72px, page headings 56px, section headings 40–48px; mobile display 48px and page headings 40px. Brand copy is warm white. Sage is reserved for actions, selected states, completion and the contact identity. Form error text is a functional accessible exception. Native product UI uses system type and Apple-like colors rather than the brand palette.

Content is capped at 1200px with 64px desktop and 24px mobile gutters. Spacing uses the supplied 4/8px scale. Cards use 16/24px corners; CTAs use pills. There are no brand gradients, glass panels, heavy shadows, continuous decorative handset motion or parallax.

## Page coverage

- Home: preserved hero wording; editorial hierarchy, two realistic 258×548px phones, quiet captions, three-stage explanation, five-scene use-case carousel with new dark outcome cards, closing Text Treena action.
- Pricing: original Personal and Plus amounts, minutes, overage and account destinations; two restrained cards and native FAQ disclosure behavior.
- Privacy: original legal copy and section links; dark reading surfaces, clear storage-state rows and calm index navigation.
- Login and account: original OAuth and email/password/phone controls; consistent buttons, labels, fields, opt-in checkbox, focus and error styles.
- Pay: original plan review and Stripe submit control; visible summary hierarchy and preserved environment-specific states.
- Start: original pending, name-entry and ready states; consistent progress and surfaces.
- Dashboard: original gated usage, billing, threads, observability, loading and empty states.
- All seven directory aliases load the same theme with correct relative paths.

## Motion

The original demo timeline, 13-second loop, captions, timer, viewport ownership, reduced-motion branch and scenario rotation are preserved. Presentation changes remove bubble scale, use a 240ms opacity transition and 480ms position transition, and shorten entrance travel to 12–16px. CSS removes decorative handset floating, scroll scale and shadow modulation. Use-case scenes use restrained opacity/position changes. Reduced-motion behavior remains static, with CSS animation/transition suppression.

## Verification

- `npm run verify`: existing functional verifier passed; no live Stripe, Fly or Linq calls.
- All 15 HTML documents retain the original form/input/select/textarea/button attributes, script source paths and inline script bodies.
- `auth.js`, `checkout.js`, `chrome.js`, `imessage.js`, Pages Functions and routing files are unchanged.
- All eight layouts checked at 390, 768, 1024 and 1440px; no horizontal overflow.
- Rendered subpage text contrast checked against the underlying surfaces: no failures against 4.5:1 normal text / 3:1 large text thresholds. Core body-on-ink contrast is 16.38:1; muted-on-surface 5.94:1; CTA text-on-sage 8.75:1.
- Gated pay/start/dashboard layouts reviewed in isolated script-free fixtures. Their real authentication gates remain in place; live authenticated behavior was not exercised.

The unrelated existing `.gitignore` edit was left intact. Preview with `npm run dev -- --port 8803`. Do not treat local preview as deployment.

Homepage scroll reveal: demo, three steps, use cases, final CTA and footer enter with a 1000ms eased 28px rise. Inner elements stagger by 90ms; phone sizing and playback stay independent. Reduced motion bypasses these effects.

Navigation transition fix: the header crossfades independently from moving page content; active capsules no longer share a geometry-morph transition or scale on hover. This prevents selector jumps between page and anchor navigation.

Demo scroll zoom: the full demo eases from 97% to 100% as its center approaches the viewport center (98.5% to 100% on mobile). Stable outer geometry prevents layout shifts. Reduced-motion keeps full size.

Latest approved homepage subhead: “Your AI phone call assistant.” This user-requested copy supersedes the earlier iMessage-specific subhead requirement. Homepage metadata and verification match.

Fluid navigation: one measured capsule follows hover, keyboard focus, selected pages and homepage section clicks with a 480ms eased glide. Native link navigation stays unchanged; reduced motion disables the glide.

Demo refinement: reduced the entrance to a 12px rise with a gentler fade, removed separate phone entrance animations, and removed the live-caption waveform.

Outcome cards advance every 3.2 seconds with a 680ms subtle rise/scale settle and border easing; captions follow after 40ms. Reduced-motion remains static.

Latest outcome transition: cards and captions slide 48px from right to left, replacing the scale/border effect. Entry is 620ms, exit 300ms; reduced motion stays static.

Outcome playback starts its first slide 200ms after becoming active in the viewport, then advances every 3.2 seconds.

iMessage demo header: continuous white surface, centered waveform avatar, vector back chevron and phone icon replace the gray strip and video icon.

Reference refinement: iMessage header uses pale round back/phone controls, a centered sage avatar and compact contact-name pill, plus a softer composer.

Product depth refinement: darker charcoal call screen, inset hardware edges and restrained contact shadows, slightly offset desktop phones, and a raised caption surface. These requested product-demo shadows are exceptions to the flat brand-card treatment.

Further depth pass: near-black demo stage and call screen, stronger phone contact/ambient shadows, neutral raised call controls and light native composer surfaces.

Latest color adjustment: demo stage #191c19 and call screen #22272b soften the near-black treatment while preserving depth.

Neutral-gray rebrand refinement: page #181818, surfaces #202020, raised surfaces #252525, borders #333333. Removed green tint from navigation capsules, form surfaces, cards, demo stage and hardware. Sage remains for buttons, brand marks, focus and small status accents. This supersedes earlier ink/surface color values.

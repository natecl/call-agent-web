# Treena dashboard backend handoff

## Task

Complete the backend integration for the approved Treena dashboard. The UI is implemented locally in `/Users/n.chinlue/code/call-agent-web`; it has not been deployed. Follow `AGENTS.md`, preserve the approved design, and do not deploy without separate authorization.

The original work was UI-only. This document describes the remaining engineering work for a separately authorized agent. Do not treat this document as permission to modify live accounts, cancel subscriptions, send messages, or deploy.

## Approved product structure

- **Plan & usage:** current plan and price, included/used/remaining minutes, usage bar, monthly reset date and days remaining, additional metered minutes and estimated charges.
- **Settings:** billing information, payment management, account/security controls, subscription management and cancellation.
- **Privacy:** current call-content retention preference and the ability to change it.
- **Profile:** bottom-left account selector opens name, email, and phone information.
- Existing threads and call details remain available through a secondary **Call activity** disclosure.

Neutral charcoal backgrounds, restrained sage accents, Manrope typography, responsive sidebar, and the approved card hierarchy should stay intact.

## Current source files

| File | Purpose |
| --- | --- |
| `public/dashboard.html` | Integrated dashboard markup |
| `public/dashboard/index.html` | Directory alias; relative paths use `../` |
| `public/dashboard-ui.css` | Account layout and component styling |
| `public/dashboard-ui.js` | Tab navigation and verified-response rendering |
| `public/checkout.js` | Existing session/name gates and dashboard request |
| `functions/api/dashboard.js` | Dashboard GET endpoint |
| `functions/_lib/dashboard.js` | Usage and billing response construction |
| `functions/api/billing.js` | Existing read-only billing endpoint |
| `functions/api/account.js` | Existing account-settings POST entry point |
| `functions/_lib/checkout.js` | Checkout verification and account-setting operations |
| `functions/_lib/auth.js` | Existing authentication helpers |
| `functions/api/auth/[[path]].js` | Authentication routes |
| `functions/_lib/stripe.js` | Stripe requests and environment mode helpers |
| `functions/_lib/sync.js` | Fly account/dashboard integration |
| `functions/_lib/plans.js` | Canonical plan pricing and minutes |
| `public/mockups/dashboard.html` and `dashboard.css` | Separate approved mockup; contains fictional values and simulated actions |
| `scripts/dashboard-ui.test.mjs` | Renderer tests |
| `scripts/verify-paywall.mjs` | Existing end-to-end mock verification |

Do not copy sample names, payment methods, reset dates, or simulated cancellation behavior from the mockup into production paths.

## What already works

`checkout.js` requests `/api/dashboard?session_id=...` using the existing verified checkout flow. It redirects accounts needing a name to onboarding, fills the existing plan fields, and calls `window.renderTreenaDashboard(result)` before revealing the dashboard.

The UI renderer uses:

- `result.name`, `firstName`, `email`, and `phone` for profile display.
- `result.usage.minutesIncluded` and `minutesUsed` for remaining minutes, overage minutes, and the progress bar.
- `result.billing.overage` for an explicitly estimated overage amount.
- `result.user.retain_call_artifacts` for the disabled retention switch.
- Existing checkout rendering for plan name, price, minutes, subscription status, test/live messaging, threads, and call details.

Remaining minutes are clamped to zero. The usage bar is capped at 100%; its accessible text still reports actual usage. Estimated overage is not an invoice or confirmed Stripe charge.

## Missing capabilities

### 1. Billing-period reset and renewal dates

`billingView()` currently fetches a Stripe subscription but only retains its status. It does not return billing-period boundaries or cancellation timing. The UI therefore shows unavailable values.

- Inspect the actual Stripe API version, subscription shape, and metering configuration before choosing the canonical period fields.
- Determine whether Fly usage is period-scoped and how its monthly counters reset. Do not assume a Stripe renewal date means the usage counter has reset.
- Return explicit period timestamps and distinguish renewal, usage reset, and scheduled cancellation.
- Define timezone and days-remaining behavior, including today, overdue, missing dates, canceled plans, and past-due subscriptions.
- Bind `[data-reset-date]`, `[data-reset-countdown]`, `[data-renewal]`, and `[data-next-payment]` only to verified values.
- Preserve unavailable states when upstream data is missing. Never calculate a fictional date from the current day.

### 2. Billing information and management

The Settings UI currently displays real account email but no verified payment method or next payment. **Manage billing** is disabled.

- Prefer a server-created Stripe Customer Portal session if it supports the configured product and desired actions.
- Authenticate the requester and derive the customer/subscription from the verified account. Never accept an arbitrary customer ID from the client.
- Validate same-origin return destinations. Keep secret keys server-side.
- Display only safe payment summaries such as brand/last four digits when available; never handle raw card details in this UI.
- Distinguish account email from Stripe billing email.
- Account for portal configuration being absent; provide a clear recoverable error.
- Confirm that plan changes and metered billing remain compatible with existing checkout products.

### 3. Cancellation

The real **Cancel plan** control is disabled. The mockup dialog is not integrated and performs no real action.

- Define and implement the intended cancellation policy, preferably a clear end-of-period flow unless the product owner directs otherwise.
- Show the actual effective date and what access/usage remains before confirmation.
- Implement authenticated ownership checks and CSRF protections appropriate to the existing auth model.
- Make repeated requests safe; handle already-canceling and already-canceled subscriptions.
- Refresh the dashboard after confirmation, show scheduled cancellation truthfully, and adjust renewal wording.
- Consider reactivation only if supported by the chosen flow; do not invent it in the UI.
- Verify that subscription status changes propagate to entitlement checks and Fly appropriately.
- Test with Stripe mocks/test mode. Do not cancel a real subscription as part of validation.

### 4. Profile/account settings

Profile is read-only; the sign-in/security management control is disabled.

- Audit `saveAccountSettings()` and its caller authentication before reusing the existing account POST endpoint for dashboard edits.
- Verify ownership rather than trusting supplied email or phone as identity.
- Determine which fields can be edited safely using existing capabilities.
- The user phone is the number they text from, not Treena’s shared number. Phone changes require an explicit identity/verification strategy and consistent synchronization.
- Preserve the rule that name is collected after signup, not on `/account`.
- Inspect the existing email/password and OAuth flows before exposing password, email, or linked-provider management. Do not imply unsupported credential operations work.
- Surface save/loading/error states and prevent duplicate submissions.

### 5. Privacy preference persistence

`#dashboard-retain` shows the account preference but is disabled.

- Verify the authoritative field and accepted values for call-artifact retention.
- Provide an authenticated update path tied to the verified account and synchronize with Fly.
- Keep saving off by default.
- Explain the scope: call audio, transcripts, and history versus login/billing records.
- Do not imply changing the preference deletes historical data unless deletion is actually implemented and confirmed.
- Revert the UI on failed saves and show a useful error. Confirm persistence by reloading the dashboard.

## Important audit items

- The dashboard currently resolves access through the existing checkout-session flow. Audit the trust boundary before adding sensitive mutations; possession of a client-provided identifier must not silently authorize arbitrary account changes.
- `billingView()` currently falls back to `active` when its subscription lookup fails. Revisit this before adding billing-state-dependent controls.
- `usageFromFly()` defaults missing counters to zero. Determine whether the UI must instead indicate unavailable usage when Fly data is absent.
- Confirm counter period, units, rounding, and overage rules against Stripe/Fly. UI estimates must not be presented as settled charges.
- Read current `AGENTS.md` for environment-specific status. It records webhook/production constraints that may change; verify fresh state without exposing secrets.
- Do not run live Linq calls, modify the sibling call-agent service, or deploy Pages under this handoff alone.

## Validation and acceptance

Run:

```sh
npm run verify
node --test scripts/dashboard-ui.test.mjs
node --check public/dashboard-ui.js
node --check public/checkout.js
git diff --check
```

Add meaningful backend tests for:

- Authenticated ownership; rejected cross-account requests and CSRF attempts.
- Stripe test/live mode separation, upstream errors, and missing portal configuration.
- Period boundaries and canceled/past-due/pending-cancellation states.
- Cancellation retries, confirmation, and status refresh.
- Profile/privacy save failures, persistence, and safe text rendering.
- No credentials or sensitive payment details in browser responses/logs.

Browser checks:

- Both `/dashboard` and `/dashboard/` routes, with correct asset paths.
- Existing unauthenticated and onboarding redirects.
- All four tabs and bottom-left Profile navigation.
- 390, 768, 1024, and 1440px widths; keyboard focus and reduced motion.
- Loading, zero usage, partial usage, exceeded allowance, missing data, and upstream failure.
- No sample data on real routes; no enabled controls that only simulate success.

Existing verification passes. Four renderer tests pass. The integrated UI was inspected with isolated fixtures at all four widths; no live account or financial actions were used.

## Completion handoff

Update `docs/FEATURE_MAP.md` to distinguish implemented, locally verified, and deployed behavior. Report which controls now work, the data sources used, test coverage, any remaining configuration dependencies, and deployment status. Keep the approved UI and avoid unrelated redesigns.

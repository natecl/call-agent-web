#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCheckoutSession, paidSessionView, saveAccountSettings, verifyCheckoutSession } from '../functions/_lib/checkout.js';
import { PLANS } from '../functions/_lib/plans.js';
import { looksLikeCheckoutSessionId, requireStripeSecret, stripeMode, verifyStripeWebhook } from '../functions/_lib/stripe.js';
import {
  ACCOUNT_SYNC_SIGNATURE_HEADER,
  DEFAULT_DASHBOARD_URL,
  DEFAULT_SYNC_URL,
  accountDashboardUrl,
  accountSyncUrl,
  firstNameFrom,
  getAccountDashboard,
  payloadFromStripeCustomer,
  postAccountSync,
  signAccountSync,
  syncFromStripeEvent,
} from '../functions/_lib/sync.js';
import { billingView, loadDashboard } from '../functions/_lib/dashboard.js';
import { unixToIso, periodFromSubscription, createBillingPortalSession, cancelSubscriptionAtPeriodEnd } from '../functions/_lib/billing.js';
import { assertUserPhone, DEFAULT_TELNYX_FROM_E164 } from '../functions/_lib/phone.js';
import { shouldRouteToDashboard } from '../functions/_lib/route.js';
import { DEFAULT_TREENA_IMESSAGE_E164, treenaIMessageView } from '../functions/_lib/imessage.js';
import { appleClientId, appleMissing, APPLE_SERVICES_ID, googleMissing, handleGoogleCallback, oauthStatus, signPayload, startAppleOAuth, startGoogleOAuth, verifyPayload } from '../functions/_lib/auth.js';
import { continuePathAfterIdentity, lookupPaidAccount, resolveAccount } from '../functions/_lib/stripe_account.js';
import { complimentaryEmails, isComplimentaryEmail, isComplimentaryGrant } from '../functions/_lib/entitlement.js';
import { onRequest as authOnRequest } from '../functions/api/auth/[[path]].js';
import { onRequestPost as checkoutPost } from '../functions/api/checkout.js';
import { onRequestPost as accountPost } from '../functions/api/account.js';
import { onRequestGet as sessionGet } from '../functions/api/session.js';
import { onRequestGet as configGet } from '../functions/api/config.js';
import { onRequestPost as webhookPost } from '../functions/api/webhook.js';
import { onRequestGet as dashboardGet } from '../functions/api/dashboard.js';
import { onRequestGet as billingGet } from '../functions/api/billing.js';
import { onRequestPost as billingPortalPost } from '../functions/api/billing/portal.js';
import { onRequestPost as billingCancelPost } from '../functions/api/billing/cancel.js';
import { onRequest as homeMiddleware } from '../functions/_middleware.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_HOME_SHA = '4e79584f9ee5b0c4dad27808b56a9f8ec3b5d860cd9c8018b1ea9089363fe316';
const LIVE_HOME_BYTES = 9395;
const IMESSAGE_LINE = 'Your phone call agent, right in iMessage';
const SETTINGS_NAME_COPY = 'Name lives in account settings after signup';
let failed = 0;

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function ok(name, cond, detail) {
  if (cond) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function customerFromForm(form, id = 'cus_test_123') {
  return {
    id,
    email: form.get('email') || 'tester@example.com',
    name: form.get('name') || null,
    phone: form.get('phone'),
    metadata: {
      plan: form.get('metadata[plan]'),
      phone: form.get('metadata[phone]'),
      minutes: form.get('metadata[minutes]'),
      retain_after_call: form.get('metadata[retain_after_call]'),
    },
  };
}

function mockStripe({ customers = [], session, subscription, subscriptions, dashboard, onCheckout, onCustomer, onFly, onDashboard, flyStatus = 200, flyFailTimes = 0, live = false } = {}) {
  const calls = [];
  let flyAttempts = 0;
  const checkoutId = live ? 'cs_live_abc' : 'cs_test_abc';
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body || '', headers: init.headers || {} });
    if (String(url).includes('/accounts/dashboard')) {
      if (onDashboard) onDashboard({ url, method: init.method || 'GET', headers: init.headers || {}, body: String(init.body || '') });
      return jsonResponse(dashboard || { ok: true, user: null, threads: [], calls: [] });
    }
    if (String(url).includes('/accounts/sync')) {
      flyAttempts += 1;
      if (onFly) onFly({ url, method: init.method || 'POST', headers: init.headers || {}, body: String(init.body || '') });
      const status = flyAttempts <= flyFailTimes ? 503 : flyStatus;
      if (status >= 500) return jsonResponse({ error: 'fly down' }, status);
      if (status === 409) return jsonResponse({ error: 'phone already belongs to another account' }, 409);
      return jsonResponse({ ok: true, user_id: 'acctnathan', skipped: false, created: true });
    }
    if (url.includes('/v1/customers?email=')) return jsonResponse({ data: customers });
    if (url.includes('/v1/customers/') && init.method === 'POST') {
      const form = new URLSearchParams(String(init.body || ''));
      if (onCustomer) onCustomer(form, 'update');
      const existing = customers[0] && customers[0].id ? customers[0].id : 'cus_test_123';
      return jsonResponse(customerFromForm(form, existing));
    }
    if (url.includes('/v1/customers/') && (init.method || 'GET') === 'GET') {
      const existing = customers[0] || {
        id: 'cus_test_123',
        name: 'Nathan Tester',
        phone: '+14155552671',
        metadata: {
          plan: 'personal',
          phone: '+14155552671',
          minutes: '30',
          retain_after_call: 'off',
        },
      };
      return jsonResponse(existing);
    }
    if (url.endsWith('/v1/customers') && init.method === 'POST') {
      const form = new URLSearchParams(String(init.body || ''));
      if (onCustomer) onCustomer(form, 'create');
      return jsonResponse(customerFromForm(form));
    }
    if (url.endsWith('/v1/checkout/sessions') && init.method === 'POST') {
      const form = new URLSearchParams(String(init.body || ''));
      if (onCheckout) onCheckout(form);
      return jsonResponse({
        id: checkoutId,
        url: `https://checkout.stripe.com/c/pay/${checkoutId}`,
      });
    }
    if (url.includes('/v1/checkout/sessions/') && (init.method || 'GET') === 'GET') {
      return jsonResponse(session);
    }
    if (url.includes('/v1/billing_portal/sessions') && init.method === 'POST') {
      return jsonResponse({
        id: 'bps_test_123',
        url: 'https://billing.stripe.com/p/session/test_portal',
      });
    }
    if (url.includes('/v1/subscriptions?') || /\/v1\/subscriptions\?/.test(url)) {
      if (Array.isArray(subscriptions)) return jsonResponse({ data: subscriptions });
      return jsonResponse({
        data: [subscription || {
          id: 'sub_test_123',
          status: 'active',
          current_period_start: 1789000000,
          current_period_end: 1791678400,
        }],
      });
    }
    if (url.includes('/v1/subscriptions/') && init.method === 'POST') {
      const form = new URLSearchParams(String(init.body || ''));
      const existing = subscription || {
        id: 'sub_test_123',
        status: 'active',
        current_period_start: 1789000000,
        current_period_end: 1791678400,
      };
      return jsonResponse({
        ...existing,
        cancel_at_period_end: form.get('cancel_at_period_end') === 'true',
        cancel_at: form.get('cancel_at_period_end') === 'true'
          ? (existing.current_period_end || 1791678400)
          : null,
      });
    }
    if (url.includes('/v1/subscriptions/') && (init.method || 'GET') === 'GET') {
      return jsonResponse(subscription || {
        id: 'sub_test_123',
        status: 'active',
      });
    }
    return jsonResponse({ error: { message: `unexpected Stripe call ${url}` } }, 500);
  };
  return { fetchImpl, calls };
}

const testEnv = {
  STRIPE_SECRET_KEY: 'sk_test_verifier',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_verifier',
};

const liveEnv = {
  STRIPE_SECRET_KEY: 'sk_live_verifier',
  STRIPE_PUBLISHABLE_KEY: 'pk_live_verifier',
};

ok('home keeps iMessage line', read('public/index.html').includes(IMESSAGE_LINE));
ok('treena theme + dashboard UI files present', existsSync(join(root, 'public/treena-theme.css')) && existsSync(join(root, 'public/dashboard-ui.css')) && existsSync(join(root, 'public/dashboard-ui.js')) && existsSync(join(root, 'public/assets/treena-icon.svg')));
ok('public pages load treena-theme.css', ['public/index.html', 'public/account.html', 'public/login.html', 'public/pay.html', 'public/start.html', 'public/pricing.html', 'public/privacy.html', 'public/dashboard.html'].every((file) => read(file).includes('treena-theme.css')));
ok('checkout-stub.js removed', !existsSync(join(root, 'public/checkout-stub.js')));
ok('client checkout.js present', existsSync(join(root, 'public/checkout.js')));

const accountHtml = read('public/account.html');
ok('account email input is required', /id="email"[^>]*required/.test(accountHtml));
ok('account password input is required', /id="password"[^>]*required/.test(accountHtml));
ok('account form has no name field', !/id="name"/.test(accountHtml));
ok('account form has no no-password copy', !/No password/.test(accountHtml));
ok('account phone input is required', /id="account-phone"[^>]*required/.test(accountHtml));
ok('account retain checkbox defaults off', /id="retain-after-call"/.test(accountHtml) && !/id="retain-after-call"[^>]*checked/.test(accountHtml));

const publicFiles = [
  'public/pricing.html',
  'public/pricing/index.html',
  'public/account.html',
  'public/account/index.html',
  'public/pay.html',
  'public/pay/index.html',
  'public/start.html',
  'public/start/index.html',
  'public/dashboard.html',
  'public/dashboard/index.html',
  'public/login.html',
  'public/login/index.html',
  'public/checkout.js',
  'public/index.html',
  'public/app.js',
  'public/imessage.js',
  'public/auth.js',
  'public/chrome.js',
];
const publicBlob = publicFiles.map(read).join('\n');
ok('no stub banners in checkout pages', !/Stub —/.test(read('public/account.html') + read('public/pay.html') + read('public/start.html')));
ok('no Stripe secret in public/', !/sk_test_|sk_live_|whsec_/.test(publicBlob));
ok('no live publishable key in public/', !/pk_live_/.test(publicBlob));
ok('home still has You text / Watch a call', /You text\./.test(read('public/index.html')) && /Watch a call/.test(read('public/index.html')));
const homeHtml = read('public/index.html');
ok('home header has Get started then Log in', /<header class="nav">[\s\S]*<div class="nav-end"><a class="button primary" href="pricing\.html">Get started<\/a><a class="nav-login" href="login\.html">Log in<\/a><\/div>/.test(homeHtml));
ok('home hero is Text Treena sms CTA', (homeHtml.match(/class="button primary text-relay" href="sms:\+12138653024">Text Treena<\/a>/g) || []).length === 1);
ok('home hero CTA is not the long get-started label', !/Text Treena to get started/.test(homeHtml));
ok('nav tabs sit next to logo, not centered', /body \.nav nav\{margin-left:0/.test(read('public/treena-theme.css')) && /body \.nav-end\{[^}]*margin-left:auto/.test(read('public/treena-theme.css')));
ok('home header Get started is not sms', !/<header class="nav">[\s\S]*text-relay[\s\S]*<\/header>/.test(homeHtml));
ok('home closing CTA is Get started', /<section class="closing">[\s\S]*?href="pricing\.html">Get started<\/a>[\s\S]*?<\/section>/.test(homeHtml) && !/<section class="closing">[\s\S]*?Text Treena[\s\S]*?<\/section>/.test(homeHtml));
ok('home header tabs match pricing (no Log in in tab row)', /<nav aria-label="Main navigation"><a href="pricing\.html">Pricing<\/a><a href="privacy\.html">Privacy<\/a><a href="#how-it-works">How it works<\/a><a href="#use-cases">What it can do<\/a><\/nav>/.test(homeHtml));

const pricing = read('public/pricing.html') + read('public/pricing/index.html');
ok('pricing has Personal $20', /Personal/.test(pricing) && /\$20/.test(pricing) && /30 connected min/.test(pricing) && /\$0\.15/.test(pricing));
ok('pricing has Plus $40', /Plus/.test(pricing) && /\$40/.test(pricing) && /90/.test(pricing) && /\$0\.12/.test(pricing));
ok('pricing CTAs go to account with plan', /account\.html\?plan=personal/.test(pricing) && /account\.html\?plan=plus/.test(pricing));
ok('pricing cards do not jump to start', !/plan-card[\s\S]*start\.html/.test(pricing));
ok('pricing hero says choose the plan', /Choose the plan you need/.test(pricing) && !/Choose the room you need/.test(pricing));
ok('pricing included FAQ starts closed', !/<details open>/.test(pricing) && /<details><summary>What’s included in each plan\?<\/summary>/.test(pricing));
ok('pricing header chrome is Get started then Log in', /<div class="nav-end"><a class="button primary" href="pricing\.html">Get started<\/a><a class="nav-login" href="login\.html">Log in<\/a><\/div>/.test(read('public/pricing.html')) && /<div class="nav-end"><a class="button primary" href="\.\.\/pricing\.html">Get started<\/a><a class="nav-login" href="\.\.\/login\.html">Log in<\/a><\/div>/.test(read('public/pricing/index.html')));
ok('no trial / free forever / annual / team / enterprise', !/\btrial\b/i.test(pricing.replace(/no trial/gi, '')) && !/free forever/i.test(pricing) && !/annual/i.test(pricing) && !/enterprise/i.test(pricing) && !/\bteam\b/i.test(pricing));

const pay = read('public/pay.html');
ok('pay posts to /api/checkout', /\/api\/checkout/.test(read('public/checkout.js')));
ok('start verifies /api/session', /\/api\/session/.test(read('public/checkout.js')));
ok('start name form is required after pay', /id="start-name-form"/.test(read('public/start.html')) && /id="name"/.test(read('public/start.html')) && /required/.test(read('public/start.html')));
ok('dashboard fetches /api/dashboard', /\/api\/dashboard/.test(read('public/checkout.js')));
ok('pay no longer marks paid locally', !/KEY\.paid|treena-stub-paid|setItem\([^)]*paid/.test(read('public/checkout.js')));
ok('start page waits for Stripe session', /session_id/.test(read('public/checkout.js')) && /start-ready/.test(read('public/start.html')));
ok('pay copy says no trial', /No trial/.test(pay));
ok('pay keeps TEST card copy behind env flag', /4242 4242 4242 4242/.test(pay) && /data-stripe-test-only/.test(pay) && /data-stripe-live-only/.test(pay));
ok('pay live copy does not claim no real charge by default', /You’ll be charged on Stripe Checkout/.test(pay));

ok('Pages Functions: checkout', existsSync(join(root, 'functions/api/checkout.js')));
ok('Pages Functions: session', existsSync(join(root, 'functions/api/session.js')));
ok('Pages Functions: webhook', existsSync(join(root, 'functions/api/webhook.js')));
ok('Pages Functions: dashboard', existsSync(join(root, 'functions/api/dashboard.js')));
ok('Pages Functions: billing', existsSync(join(root, 'functions/api/billing.js')));
ok('Pages Functions helpers are private (_lib)', existsSync(join(root, 'functions/_lib/checkout.js')));
ok('locked plans are Personal $20 and Plus $40', PLANS.personal.amountCents === 2000 && PLANS.plus.amountCents === 4000 && Object.keys(PLANS).length === 2);

ok('live Stripe secret is accepted', stripeMode('sk_live_nope') === 'live' && requireStripeSecret('sk_live_nope') === 'live');
ok('test Stripe secret is accepted', requireStripeSecret('sk_test_verifier') === 'test');
ok('junk checkout ids are not sessions', looksLikeCheckoutSessionId('null', 'test') === '' && looksLikeCheckoutSessionId('undefined') === '' && looksLikeCheckoutSessionId('cs_test_abc', 'test') === 'cs_test_abc' && looksLikeCheckoutSessionId('cs_live_abc', 'test') === '');

let missingRejected = false;
try {
  requireStripeSecret('');
} catch (error) {
  missingRejected = error.status === 503;
}
ok('missing Stripe secret is 503', missingRejected);

let junkRejected = false;
try {
  requireStripeSecret('not-a-stripe-key');
} catch (error) {
  junkRejected = error.status === 500;
}
ok('junk Stripe secret is 500', junkRejected);

let checkoutForm;
const { fetchImpl, calls } = mockStripe({
  onCheckout(form) {
    checkoutForm = form;
  },
});
const created = await createCheckoutSession(testEnv, {
  origin: 'https://usetreena.com',
  planId: 'personal',
  email: 'tester@example.com',
  name: 'Tester',
  phone: '+14155552671',
  fetchImpl,
});
ok('checkout returns TEST session URL', created.url.startsWith('https://checkout.stripe.com/') && created.id.startsWith('cs_test_'));
ok('checkout creates Stripe Customer then session', calls.some((c) => c.url.includes('/v1/customers')) && calls.some((c) => c.url.endsWith('/checkout/sessions')));
ok('checkout mode is subscription', checkoutForm.get('mode') === 'subscription');
ok('checkout has no trial', !checkoutForm.has('subscription_data[trial_period_days]') && ![...checkoutForm.keys()].some((k) => k.includes('trial')));
ok('personal unit amount is 2000', checkoutForm.get('line_items[0][price_data][unit_amount]') === '2000');
ok('success lands on /start.html', /\/start\.html\?session_id=\{CHECKOUT_SESSION_ID\}/.test(checkoutForm.get('success_url')));
ok('cancel returns to /pay.html with plan', /\/pay\.html\?plan=personal/.test(checkoutForm.get('cancel_url')));

const liveCheckout = mockStripe({ live: true });
const createdLive = await createCheckoutSession(liveEnv, {
  origin: 'https://usetreena.com',
  planId: 'personal',
  email: 'tester@example.com',
  name: 'Tester',
  phone: '+14155552671',
  fetchImpl: liveCheckout.fetchImpl,
});
ok('checkout returns LIVE session URL when sk_live_ is set', createdLive.url.startsWith('https://checkout.stripe.com/') && createdLive.id.startsWith('cs_live_'));

const plusMock = mockStripe({
  onCheckout(form) { checkoutForm = form; },
});
await createCheckoutSession(testEnv, {
  origin: 'https://usetreena.com',
  planId: 'plus',
  email: 'tester@example.com',
  name: 'Tester',
  phone: '+14155552671',
  fetchImpl: plusMock.fetchImpl,
});
ok('plus unit amount is 4000', checkoutForm.get('line_items[0][price_data][unit_amount]') === '4000');

const priced = mockStripe({
  onCheckout(form) { checkoutForm = form; },
});
await createCheckoutSession({ ...testEnv, STRIPE_PRICE_PERSONAL: 'price_test_personal' }, {
  origin: 'https://usetreena.com',
  planId: 'personal',
  email: 'tester@example.com',
  name: 'Tester',
  phone: '+14155552671',
  fetchImpl: priced.fetchImpl,
});
ok('uses Price ID when STRIPE_PRICE_PERSONAL is set', checkoutForm.get('line_items[0][price]') === 'price_test_personal' && !checkoutForm.has('line_items[0][price_data][unit_amount]'));

let badPlan = false;
try {
  await createCheckoutSession(testEnv, { origin: 'https://usetreena.com', planId: 'enterprise', email: 'a@b.com', name: 'Tester', phone: '+14155552671', fetchImpl });
} catch (error) {
  badPlan = error.status === 400;
}
ok('unknown plans rejected', badPlan);

const paid = paidSessionView({
  id: 'cs_test_abc',
  status: 'complete',
  payment_status: 'paid',
  mode: 'subscription',
  metadata: { plan: 'plus', email: 'tester@example.com', phone: '+14155552671' },
  customer: 'cus_test_123',
  subscription: 'sub_test_123',
});
ok('paid session unlocks start', paid.ok && paid.plan === 'plus');

let unpaid = false;
try {
  paidSessionView({
    id: 'cs_test_abc',
    status: 'open',
    payment_status: 'unpaid',
    mode: 'subscription',
    metadata: { plan: 'personal', phone: '+14155552671' },
  });
} catch (error) {
  unpaid = error.status === 402;
}
ok('unpaid session does not unlock start', unpaid);

const verifyMock = mockStripe({
  session: {
    id: 'cs_test_abc',
    status: 'complete',
    payment_status: 'paid',
    mode: 'subscription',
    metadata: { plan: 'personal', email: 'tester@example.com', phone: '+14155552671' },
    customer: 'cus_test_123',
    subscription: 'sub_test_123',
  },
});
const verified = await verifyCheckoutSession(testEnv, 'cs_test_abc', verifyMock.fetchImpl);
ok('session verifier reads Stripe TEST session', verified.ok && verified.sessionId === 'cs_test_abc');

let liveSession = false;
try {
  await verifyCheckoutSession(testEnv, 'cs_live_abc', verifyMock.fetchImpl);
} catch (error) {
  liveSession = error.message.includes('does not match TEST');
}
ok('live Checkout Sessions rejected on TEST keys', liveSession);

const liveVerifyMock = mockStripe({
  live: true,
  session: {
    id: 'cs_live_abc',
    status: 'complete',
    payment_status: 'paid',
    mode: 'subscription',
    metadata: { plan: 'personal', email: 'tester@example.com', phone: '+14155552671' },
    customer: 'cus_test_123',
    subscription: 'sub_test_123',
  },
});
const liveVerified = await verifyCheckoutSession(liveEnv, 'cs_live_abc', liveVerifyMock.fetchImpl);
ok('session verifier reads Stripe LIVE session', liveVerified.ok && liveVerified.sessionId === 'cs_live_abc');

const previousFetch = globalThis.fetch;
globalThis.fetch = mockStripe({
  onCheckout() {},
}).fetchImpl;
try {
  const req = new Request('https://usetreena.com/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'personal', email: 'tester@example.com', name: 'Tester', phone: '+14155552671' }),
  });
  const res = await checkoutPost({ request: req, env: testEnv });
  const body = await res.json();
  ok('POST /api/checkout handler (mocked Stripe)', res.status === 200 && body.url.includes('checkout.stripe.com'));
} finally {
  globalThis.fetch = previousFetch;
}

globalThis.fetch = mockStripe({
  session: {
    id: 'cs_test_abc',
    status: 'complete',
    payment_status: 'paid',
    mode: 'subscription',
    metadata: { plan: 'personal', email: 'tester@example.com', phone: '+14155552671' },
    customer: 'cus_test_123',
    subscription: 'sub_test_123',
  },
}).fetchImpl;
try {
  const req = new Request('https://usetreena.com/api/session?session_id=cs_test_abc');
  const res = await sessionGet({ request: req, env: testEnv });
  const body = await res.json();
  ok('GET /api/session handler (mocked Stripe)', res.status === 200 && body.ok === true);
} finally {
  globalThis.fetch = previousFetch;
}

const configRes = await configGet({ request: new Request('https://usetreena.com/api/config'), env: testEnv });
const configBody = await configRes.json();
ok('GET /api/config is TEST when sk_test_ is set', configRes.status === 200 && configBody.mode === 'test' && configBody.configured === true && configBody.stripeLive === false);
ok('publishable key is pk_test_', String(configBody.publishableKey || '').startsWith('pk_test_'));
ok('config publishes shared iMessage DID', configBody.imessage && configBody.imessage.e164 === '+12138653024' && configBody.imessage.smsUrl === 'sms:+12138653024' && configBody.imessage.shared === true);
ok('config exposes webhookConfigured without inventing the secret', configBody.webhookConfigured === false);

const liveConfig = await configGet({
  request: new Request('https://usetreena.com/api/config'),
  env: liveEnv,
});
const liveConfigBody = await liveConfig.json();
ok('GET /api/config is LIVE when sk_live_ is set', liveConfig.status === 200 && liveConfigBody.mode === 'live' && liveConfigBody.configured === true && liveConfigBody.stripeLive === true);
ok('live publishable key is pk_live_', String(liveConfigBody.publishableKey || '').startsWith('pk_live_'));

const mismatchConfig = await configGet({
  request: new Request('https://usetreena.com/api/config'),
  env: { STRIPE_SECRET_KEY: 'sk_live_nope', STRIPE_PUBLISHABLE_KEY: 'pk_test_x' },
});
ok('config rejects live secret + TEST publishable', mismatchConfig.status === 500);

const webhookSecret = 'whsec_verifier';
const payload = JSON.stringify({
  type: 'checkout.session.completed',
  data: { object: { metadata: { plan: 'personal', phone: '+14155552671' }, client_reference_id: 'personal' } },
});
const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac('sha256', webhookSecret).update(`${timestamp}.${payload}`).digest('hex');
await verifyStripeWebhook(webhookSecret, payload, `t=${timestamp},v1=${signature}`);
ok('webhook signature verifies', true);

const webhookRes = await webhookPost({
  request: new Request('https://usetreena.com/api/webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
    body: payload,
  }),
  env: { STRIPE_WEBHOOK_SECRET: webhookSecret },
});
const webhookBody = await webhookRes.json();
ok('POST /api/webhook accepts signed TEST event', webhookRes.status === 200 && webhookBody.received === true);

const missingWebhook = await webhookPost({
  request: new Request('https://usetreena.com/api/webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
    body: payload,
  }),
  env: {},
});
ok('webhook without STRIPE_WEBHOOK_SECRET is 503', missingWebhook.status === 503);

const badWebhook = await webhookPost({
  request: new Request('https://usetreena.com/api/webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': `t=${timestamp},v1=${'0'.repeat(64)}` },
    body: payload,
  }),
  env: { STRIPE_WEBHOOK_SECRET: webhookSecret },
});
ok('webhook rejects bad signature', badWebhook.status === 400);

ok('Pages Functions: account settings save', existsSync(join(root, 'functions/api/account.js')));
ok('sync helper is private (_lib)', existsSync(join(root, 'functions/_lib/sync.js')));
const functionsBlob = [
  'functions/_lib/sync.js',
  'functions/_lib/checkout.js',
  'functions/_lib/stripe.js',
  'functions/api/webhook.js',
  'functions/api/account.js',
  'functions/api/checkout.js',
  'functions/api/dashboard.js',
  'functions/api/billing.js',
  'functions/api/billing/portal.js',
  'functions/api/billing/cancel.js',
  'functions/_lib/dashboard.js',
  'functions/_lib/imessage.js',
  'functions/_lib/auth.js',
  'functions/api/auth/[[path]].js',
].map(read).join('\n');
ok('website never opens NEON_DATABASE_URL', !/NEON_DATABASE_URL/.test(functionsBlob));
ok('account sync URL defaults to Fly origin', accountSyncUrl({}) === DEFAULT_SYNC_URL);
ok('CALL_AGENT_SYNC_URL wins over PUBLIC_BASE_URL', accountSyncUrl({
  CALL_AGENT_SYNC_URL: 'https://example.test/accounts/sync',
  PUBLIC_BASE_URL: 'https://hidden-beacon-080.fly.dev',
}) === 'https://example.test/accounts/sync');
ok('PUBLIC_BASE_URL builds /accounts/sync', accountSyncUrl({
  PUBLIC_BASE_URL: 'https://hidden-beacon-080.fly.dev/',
}) === 'https://hidden-beacon-080.fly.dev/accounts/sync');
ok('dashboard URL defaults to Fly origin', accountDashboardUrl({}) === DEFAULT_DASHBOARD_URL);
ok('dashboard URL derived from CALL_AGENT_SYNC_URL', accountDashboardUrl({
  CALL_AGENT_SYNC_URL: 'https://example.test/accounts/sync',
}) === 'https://example.test/accounts/dashboard');
ok('PUBLIC_BASE_URL builds /accounts/dashboard', accountDashboardUrl({
  PUBLIC_BASE_URL: 'https://hidden-beacon-080.fly.dev/',
}) === 'https://hidden-beacon-080.fly.dev/accounts/dashboard');
ok('first name is the first token', firstNameFrom('Nathan Tester') === 'Nathan' && firstNameFrom('') === null);

const TEST_PHONE = '+14155552671';

const tre20Customer = {
  id: 'cus_test_123',
  name: 'Nathan Tester',
  phone: TEST_PHONE,
  metadata: {
    plan: 'personal',
    phone: TEST_PHONE,
    minutes: '30',
    retain_after_call: 'off',
  },
};
const mapped = payloadFromStripeCustomer(tre20Customer, { eventCreated: 1789200000 });
ok('TRE-20 map: phone, plan, minutes, retain, stripe id', mapped.phone === TEST_PHONE
  && mapped.plan === 'personal'
  && mapped.minutes_included === 30
  && mapped.retain_call_artifacts === false
  && mapped.stripe_customer_id === 'cus_test_123');
ok('TRE-20 map omits minutes_used', !('minutes_used' in mapped));
ok('TRE-20 map: first_name + prefs.full_name', mapped.first_name === 'Nathan' && mapped.prefs.full_name === 'Nathan Tester');
ok('TRE-20 map: stripe_event_created is ISO-8601', /^\d{4}-\d{2}-\d{2}T/.test(mapped.stripe_event_created));
ok('TRE-20 map does not invent user_id', !('user_id' in mapped));

const syncSecret = 'sync-secret';
const signedBody = JSON.stringify({ phone: TEST_PHONE });
const nodeSig = `sha256=${createHmac('sha256', syncSecret).update(signedBody).digest('hex')}`;
const webSig = await signAccountSync(syncSecret, signedBody);
ok('HMAC matches Fly sha256= hex of raw body', webSig === nodeSig && webSig.startsWith('sha256='));

const syncEnv = { ...testEnv, ACCOUNT_SYNC_SECRET: syncSecret };
let flyPost;
const flyMock = mockStripe({
  onFly(post) { flyPost = post; },
});
const posted = await postAccountSync(syncEnv, mapped, flyMock.fetchImpl, { required: true });
ok('POST /accounts/sync returns Fly upsert', posted.ok === true && posted.user_id === 'acctnathan');
ok('POST uses Fly origin and JSON content-type', flyPost.url === DEFAULT_SYNC_URL && /application\/json/i.test(flyPost.headers['content-type']));
ok('POST signs the raw body', flyPost.headers[ACCOUNT_SYNC_SIGNATURE_HEADER] === await signAccountSync(syncSecret, flyPost.body));
const sent = JSON.parse(flyPost.body);
ok('POST body is TRE-20 mapped JSON', sent.phone === TEST_PHONE && sent.first_name === 'Nathan' && sent.plan === 'personal');

const skipNoSecret = await postAccountSync(testEnv, mapped, flyMock.fetchImpl);
ok('missing ACCOUNT_SYNC_SECRET skips (webhook path)', skipNoSecret.skipped === true);

let requiredSecret = false;
try {
  await postAccountSync(testEnv, mapped, flyMock.fetchImpl, { required: true });
} catch (error) {
  requiredSecret = error.status === 503;
}
ok('settings save without secret is 503', requiredSecret);

let flyTries = 0;
const retryMock = mockStripe({
  flyFailTimes: 2,
  onFly() { flyTries += 1; },
});
const retried = await postAccountSync(syncEnv, mapped, retryMock.fetchImpl, { required: true });
ok('retries Fly 5xx then succeeds', retried.ok === true && flyTries === 3);

const checkoutEvent = {
  type: 'checkout.session.completed',
  created: 1789200000,
  data: {
    object: {
      customer: 'cus_test_123',
      metadata: { plan: 'personal', phone: TEST_PHONE, minutes: '30', retain_after_call: 'off', name: 'Nathan Tester' },
      client_reference_id: 'personal',
    },
  },
};
let checkoutFly;
const checkoutSyncMock = mockStripe({
  onFly(post) { checkoutFly = post; },
});
const checkoutSync = await syncFromStripeEvent(syncEnv, checkoutEvent, checkoutSyncMock.fetchImpl);
ok('checkout.session.completed POSTs Fly', checkoutSync.ok === true && JSON.parse(checkoutFly.body).stripe_customer_id === 'cus_test_123');

let updatedFly;
const updatedSync = await syncFromStripeEvent(syncEnv, {
  type: 'customer.updated',
  created: 1789200001,
  data: { object: tre20Customer },
}, mockStripe({ onFly(post) { updatedFly = post; } }).fetchImpl);
ok('customer.updated POSTs Fly', updatedSync.ok === true && JSON.parse(updatedFly.body).phone === TEST_PHONE);

const skippedType = await syncFromStripeEvent(syncEnv, { type: 'invoice.paid', data: { object: {} } }, flyMock.fetchImpl);
ok('unrelated Stripe events do not POST Fly', skippedType.skipped === true);

const noSecretSync = await syncFromStripeEvent(testEnv, checkoutEvent, flyMock.fetchImpl);
ok('webhook without ACCOUNT_SYNC_SECRET does not POST Fly', noSecretSync.skipped === true);

let savedFly;
let savedCustomer;
const saveMock = mockStripe({
  customers: [{ id: 'cus_existing', metadata: { plan: 'plus' } }],
  onCustomer(form, kind) {
    savedCustomer = kind === 'update'
      && form.get('phone') === TEST_PHONE
      && form.get('name') === 'Nathan Tester'
      && form.get('metadata[plan]') === 'plus'
      && form.get('metadata[minutes]') === '90'
      && form.get('metadata[retain_after_call]') === 'on';
  },
  onFly(post) { savedFly = post; },
});
const saved = await saveAccountSettings(syncEnv, {
  email: 'tester@example.com',
  name: 'Nathan Tester',
  phone: TEST_PHONE,
  planId: 'plus',
  retainAfterCall: 'on',
  fetchImpl: saveMock.fetchImpl,
});
ok('account settings save writes Stripe then Fly', saved.ok === true && savedCustomer === true && JSON.parse(savedFly.body).plan === 'plus' && JSON.parse(savedFly.body).retain_call_artifacts === true && JSON.parse(savedFly.body).minutes_included === 90);

let missingAccount = false;
try {
  await saveAccountSettings(syncEnv, {
    email: 'nobody@example.com',
    name: 'Nathan',
    phone: TEST_PHONE,
    planId: 'personal',
    fetchImpl: mockStripe({ customers: [] }).fetchImpl,
  });
} catch (error) {
  missingAccount = error.status === 404;
}
ok('account settings save without Stripe Customer is 404', missingAccount);

const previousFetch2 = globalThis.fetch;
globalThis.fetch = mockStripe({
  customers: [{ id: 'cus_existing', email: 'tester@example.com', phone: TEST_PHONE, metadata: { plan: 'personal', phone: TEST_PHONE, minutes: '30', retain_after_call: 'off' } }],
  session: {
    id: 'cs_test_abc',
    status: 'complete',
    payment_status: 'paid',
    mode: 'subscription',
    metadata: { plan: 'personal', email: 'tester@example.com', phone: TEST_PHONE },
    customer: 'cus_existing',
    subscription: 'sub_test_123',
  },
  onFly() {},
}).fetchImpl;
try {
  const req = new Request('https://usetreena.com/api/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: 'cs_test_abc', plan: 'personal', email: 'tester@example.com', name: 'Nathan Tester', phone: TEST_PHONE, retainAfterCall: 'off' }),
  });
  const res = await accountPost({ request: req, env: syncEnv });
  const body = await res.json();
  ok('POST /api/account handler (mocked Stripe + Fly)', res.status === 200 && body.ok === true && body.phone === TEST_PHONE);
} finally {
  globalThis.fetch = previousFetch2;
}

const webhookSyncSecret = 'whsec_verifier';
const checkoutPayload = JSON.stringify({
  type: 'checkout.session.completed',
  created: 1789200000,
  data: {
    object: {
      customer: 'cus_test_123',
      metadata: { plan: 'personal', phone: TEST_PHONE, minutes: '30', retain_after_call: 'off', name: 'Nathan Tester' },
      client_reference_id: 'personal',
    },
  },
});
const checkoutTs = Math.floor(Date.now() / 1000);
const checkoutSig = createHmac('sha256', webhookSyncSecret).update(`${checkoutTs}.${checkoutPayload}`).digest('hex');
const previousFetch3 = globalThis.fetch;
let webhookFlyBody;
globalThis.fetch = mockStripe({
  onFly(post) { webhookFlyBody = post.body; },
}).fetchImpl;
try {
  const res = await webhookPost({
    request: new Request('https://usetreena.com/api/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${checkoutTs},v1=${checkoutSig}` },
      body: checkoutPayload,
    }),
    env: { STRIPE_WEBHOOK_SECRET: webhookSyncSecret, STRIPE_SECRET_KEY: 'sk_test_verifier', ACCOUNT_SYNC_SECRET: syncSecret },
  });
  const body = await res.json();
  ok('webhook checkout.session.completed POSTs signed Fly sync', res.status === 200 && body.received === true && body.sync && body.sync.ok === true && JSON.parse(webhookFlyBody).phone === TEST_PHONE);
} finally {
  globalThis.fetch = previousFetch3;
}

ok('first-time account continue still goes to pay', /location\.href = href\('pay\.html'/.test(read('public/checkout.js')));
ok('signup does not collect name', !/id="name"/.test(read('public/account.html')) && /name is not collected on \/account/.test(read('public/checkout.js')));
ok('home still has iMessage line in index', read('public/index.html').includes(IMESSAGE_LINE));
ok('account copy: name lives in settings after signup', read('public/account.html').includes(SETTINGS_NAME_COPY) && read('public/account/index.html').includes(SETTINGS_NAME_COPY));
ok('start collects name and settings copy', /id="start-name-form"/.test(read('public/start.html')) && /id="name"/.test(read('public/start.html')) && read('public/start.html').includes(SETTINGS_NAME_COPY) && read('public/start/index.html').includes(SETTINGS_NAME_COPY));
ok('dashboard copy: name lives in settings after signup', read('public/dashboard.html').includes(SETTINGS_NAME_COPY) && read('public/dashboard/index.html').includes(SETTINGS_NAME_COPY));
ok('OAuth provider sign-in present', /Sign in with Google/.test(publicBlob) && /Sign in with Apple/.test(publicBlob) && /accounts\.google\.com/.test(functionsBlob));
ok('login.html is not the homepage', existsSync(join(root, 'public/login.html')) && existsSync(join(root, 'public/login/index.html')) && /Log in to Treena/.test(read('public/login.html')) && !/id="hero-title"/.test(read('public/login.html')));
ok('_redirects aliases signin to /login', /\/signin \/login 301/.test(read('public/_redirects')) && existsSync(join(root, 'public/login.html')) && existsSync(join(root, 'public/login/index.html')));
ok('coming-soon copy is gone', !/coming soon/i.test(publicBlob + read('public/pricing.html') + read('public/start.html') + read('public/login.html')));
ok('Text Treena CTAs use the sandbox DID', /sms:\+12138653024/.test(read('public/index.html')) && /sms:\+12138653024/.test(read('public/start.html')) && read('public/imessage.js').includes(DEFAULT_TREENA_IMESSAGE_E164));
ok('account phone is the user number, not a Treena DID', /Not Treena’s shared bot number/.test(read('public/account.html')) && !/per-user Treena DID/.test(read('public/account.html')));
ok('imessage helper defaults to Cap DID', treenaIMessageView({}).e164 === '+12138653024' && treenaIMessageView({ PUBLIC_TREENA_IMESSAGE_E164: '+14155550100' }).e164 === '+14155550100');

const googleMissingKeys = googleMissing({});
ok('google missing names GOOGLE_CLIENT_ID + secret + AUTH_SESSION_SECRET', googleMissingKeys.includes('GOOGLE_CLIENT_ID') && googleMissingKeys.includes('GOOGLE_CLIENT_SECRET') && googleMissingKeys.includes('AUTH_SESSION_SECRET'));
ok('apple missing names Apple + AUTH_SESSION_SECRET', appleMissing({}).includes('APPLE_TEAM_ID') && appleMissing({}).includes('APPLE_PRIVATE_KEY') && appleMissing({}).includes('AUTH_SESSION_SECRET') && !appleMissing({}).includes('APPLE_CLIENT_ID'));
ok('apple client defaults to com.usetreena.signin', appleClientId({}) === APPLE_SERVICES_ID && APPLE_SERVICES_ID === 'com.usetreena.signin');
ok('oauth status is false without secrets', oauthStatus({}).google === false && oauthStatus({}).apple === false);

const googleBlocked = await startGoogleOAuth({}, new Request('https://usetreena.com/api/auth/google'));
ok('google start without secrets redirects to /login with missing keys', googleBlocked.status === 302 && /\/login\?/.test(googleBlocked.headers.get('Location')) && /GOOGLE_CLIENT_ID/.test(googleBlocked.headers.get('Location')));
const appleBlocked = await startAppleOAuth({}, new Request('https://usetreena.com/api/auth/apple'));
ok('apple start without secrets redirects to /login with missing keys', appleBlocked.status === 302 && /APPLE_TEAM_ID/.test(appleBlocked.headers.get('Location')));

const googleReady = await startGoogleOAuth({
  GOOGLE_CLIENT_ID: 'treena.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  AUTH_SESSION_SECRET: 'auth-session-secret',
}, new Request('https://usetreena.com/api/auth/google'));
ok('google start with secrets redirects to Google', googleReady.status === 302 && String(googleReady.headers.get('Location')).startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
const googleAuthUrl = new URL(googleReady.headers.get('Location'));
ok('google callback is usetreena.com/api/auth/google/callback', googleAuthUrl.searchParams.get('redirect_uri') === 'https://usetreena.com/api/auth/google/callback');

const wwwGoogle = await startGoogleOAuth({
  GOOGLE_CLIENT_ID: 'treena.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  AUTH_SESSION_SECRET: 'auth-session-secret',
}, new Request('https://www.usetreena.com/api/auth/google'));
ok('www host pins OAuth callback to apex', new URL(wwwGoogle.headers.get('Location')).searchParams.get('redirect_uri') === 'https://usetreena.com/api/auth/google/callback');

const appleReady = await startAppleOAuth({
  APPLE_TEAM_ID: 'TEAMID',
  APPLE_KEY_ID: 'KEYID',
  APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----',
  AUTH_SESSION_SECRET: 'auth-session-secret',
}, new Request('https://usetreena.com/api/auth/apple'));
const appleAuthUrl = new URL(appleReady.headers.get('Location'));
ok('apple start with secrets redirects to Apple', appleReady.status === 302 && String(appleReady.headers.get('Location')).startsWith('https://appleid.apple.com/auth/authorize'));
ok('apple client is com.usetreena.signin', appleAuthUrl.searchParams.get('client_id') === 'com.usetreena.signin');
ok('apple callback is usetreena.com/api/auth/apple/callback', appleAuthUrl.searchParams.get('redirect_uri') === 'https://usetreena.com/api/auth/apple/callback');

const googleCookies = typeof googleReady.headers.getSetCookie === 'function'
  ? googleReady.headers.getSetCookie()
  : [googleReady.headers.get('Set-Cookie')].filter(Boolean);
const googleCookieHeader = googleCookies.map((item) => String(item).split(';')[0]).join('; ');
const googleCb = await handleGoogleCallback({
  GOOGLE_CLIENT_ID: 'treena.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  AUTH_SESSION_SECRET: 'auth-session-secret',
}, new Request(`https://usetreena.com/api/auth/google/callback?code=abc&state=${encodeURIComponent(googleAuthUrl.searchParams.get('state'))}`, {
  headers: { Cookie: googleCookieHeader },
}), async (url) => {
  if (String(url).includes('oauth2.googleapis.com/token')) {
    return new Response(JSON.stringify({ access_token: 'atok' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).includes('openidconnect.googleapis.com')) {
    return new Response(JSON.stringify({ email: 'nate@usetreena.com', sub: 'gid-1', name: 'Nathan' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
});
ok('google callback sets session and returns to pay', googleCb.status === 302 && /\/pay\.html/.test(googleCb.headers.get('Location')) && /plan=personal/.test(googleCb.headers.get('Location')) && /treena_auth=/.test(String(typeof googleCb.headers.getSetCookie === 'function' ? googleCb.headers.getSetCookie().join(';') : googleCb.headers.get('Set-Cookie'))));

ok('OAuth identity skip goes from account details to pay', continuePathAfterIdentity('/account.html?plan=personal', false) === '/pay.html?plan=personal' && continuePathAfterIdentity('/account.html?plan=plus', false) === '/pay.html?plan=plus' && continuePathAfterIdentity('/login', false) === '/pay.html?plan=personal');
ok('OAuth identity skip sends paid accounts to dashboard', continuePathAfterIdentity('/account.html?plan=personal', true) === '/dashboard');
ok('auth.js advances signed-in signup off Your details', /location\.replace\(payPath\(\)\)/.test(read('public/auth.js')) && /continuePathAfterIdentity/.test(read('functions/_lib/auth.js')));
ok('pay collects phone if OAuth skipped account details', /id="pay-phone"/.test(read('public/pay.html')) && /id="pay-details"/.test(read('public/pay.html')) && /id="pay-phone"/.test(read('public/pay/index.html')));

ok('complimentary env parses allowlist', complimentaryEmails({ COMPLIMENTARY_ENTITLEMENT_EMAILS: 'Nate@usetreena.com, ops@usetreena.com' }).includes('nate@usetreena.com') && isComplimentaryEmail({ COMPLIMENTARY_ENTITLEMENT_EMAILS: 'nate@usetreena.com' }, 'Nate@usetreena.com') && !isComplimentaryEmail({}, 'nate@usetreena.com'));
ok('complimentary grant is not a Customer Portal account', isComplimentaryGrant({ complimentary: true }) === true && isComplimentaryGrant({ complimentary: true, subscriptionId: 'sub_paid' }) === false && isComplimentaryGrant({ complimentary: false }) === false);

const grantEnv = {
  ...testEnv,
  AUTH_SESSION_SECRET: 'auth-session-secret',
  COMPLIMENTARY_ENTITLEMENT_EMAILS: 'nate@usetreena.com',
};
const noSubMock = mockStripe({ customers: [], subscriptions: [] });
const granted = await lookupPaidAccount(grantEnv, 'nate@usetreena.com', noSubMock.fetchImpl);
ok('complimentary lookup entitles without a Stripe subscription', granted && granted.hasAccount === true && granted.complimentary === true && granted.plan === 'personal' && !granted.subscriptionId);

const notEntitled = await lookupPaidAccount(testEnv, 'other@usetreena.com', mockStripe({
  customers: [{ id: 'cus_unpaid', email: 'other@usetreena.com', metadata: { plan: 'personal' } }],
  subscriptions: [],
}).fetchImpl);
ok('non-allowlisted email without subscription is not entitled', !notEntitled || notEntitled.hasAccount === false);

let createdComplimentary = null;
const createGrantMock = mockStripe({
  customers: [],
  subscriptions: [],
  onCustomer(form, kind) { createdComplimentary = { form, kind }; },
});
const ensured = await resolveAccount(grantEnv, { email: 'nate@usetreena.com', name: 'Nathan' }, createGrantMock.fetchImpl);
ok('complimentary grant creates a Stripe Customer and not a subscription', ensured && ensured.hasAccount === true && ensured.complimentary === true && Boolean(ensured.customerId) && createdComplimentary && createdComplimentary.kind === 'create' && createdComplimentary.form.get('metadata[complimentary]') === 'on' && !createGrantMock.calls.some((call) => String(call.url).includes('/v1/checkout/sessions') || (String(call.url).includes('/v1/subscriptions') && call.method === 'POST')));

const grantGoogle = await startGoogleOAuth({
  GOOGLE_CLIENT_ID: 'treena.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  AUTH_SESSION_SECRET: 'auth-session-secret',
  STRIPE_SECRET_KEY: 'sk_test_verifier',
  COMPLIMENTARY_ENTITLEMENT_EMAILS: 'nate@usetreena.com',
}, new Request('https://usetreena.com/api/auth/google?next=/account.html?plan=personal'));
const grantGoogleUrl = new URL(grantGoogle.headers.get('Location'));
const grantCookies = typeof grantGoogle.headers.getSetCookie === 'function'
  ? grantGoogle.headers.getSetCookie()
  : [grantGoogle.headers.get('Set-Cookie')].filter(Boolean);
const grantCookieHeader = grantCookies.map((item) => String(item).split(';')[0]).join('; ');
const grantStripe = mockStripe({ customers: [], subscriptions: [] });
const grantCb = await handleGoogleCallback({
  GOOGLE_CLIENT_ID: 'treena.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  AUTH_SESSION_SECRET: 'auth-session-secret',
  STRIPE_SECRET_KEY: 'sk_test_verifier',
  COMPLIMENTARY_ENTITLEMENT_EMAILS: 'nate@usetreena.com',
}, new Request(`https://usetreena.com/api/auth/google/callback?code=abc&state=${encodeURIComponent(grantGoogleUrl.searchParams.get('state'))}`, {
  headers: { Cookie: grantCookieHeader },
}), async (url, init) => {
  if (String(url).includes('oauth2.googleapis.com/token')) {
    return new Response(JSON.stringify({ access_token: 'atok' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).includes('openidconnect.googleapis.com')) {
    return new Response(JSON.stringify({ email: 'nate@usetreena.com', sub: 'gid-1', name: 'Nathan' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return grantStripe.fetchImpl(url, init);
});
ok('complimentary Google OAuth lands on dashboard without checkout', grantCb.status === 302 && /\/dashboard/.test(grantCb.headers.get('Location')));

const routed = await authOnRequest({
  request: new Request('https://usetreena.com/api/auth/me'),
  env: {},
  params: { path: ['me'] },
});
const meBody = await routed.json();
ok('GET /api/auth/me works without session', routed.status === 200 && meBody.signedIn === false);

const signed = await signPayload('auth-session-secret', { email: 'a@b.com', exp: Math.floor(Date.now() / 1000) + 60 });
const authPayload = await verifyPayload('auth-session-secret', signed);
ok('auth payload roundtrip', authPayload.email === 'a@b.com');

const dashboardHtml = read('public/dashboard.html') + read('public/dashboard/index.html');
ok('dashboard has usage billing threads observability settings', /id="usage"/.test(dashboardHtml) && /id="billing"/.test(dashboardHtml) && /id="threads"/.test(dashboardHtml) && /id="observability"/.test(dashboardHtml) && /id="settings"/.test(dashboardHtml));
ok('dashboard billing TEST badge is env-gated', /class="test-badge"/.test(dashboardHtml) && /data-stripe-test-only/.test(dashboardHtml) && /No real charge/.test(dashboardHtml) && /Billed on Stripe/.test(dashboardHtml));
ok('dashboard usage minutes + calls', /data-minutes-included/.test(dashboardHtml) && /data-minutes-used/.test(dashboardHtml) && /data-call-count/.test(dashboardHtml) && /Usage totals update after calls/.test(dashboardHtml));
ok('dashboard billing period + portal + cancel', /data-period-end/.test(dashboardHtml) && /id="manage-billing"/.test(dashboardHtml) && /id="cancel-plan"/.test(dashboardHtml) && /Stripe Customer Portal/.test(dashboardHtml));
ok('dashboard complimentary grant copy', /Complimentary access\. No Stripe charge/.test(dashboardHtml) && /data-complimentary-only/.test(dashboardHtml) && /Manage billing is for paid Stripe subscriptions/.test(dashboardHtml) && !/Manage billing opens Stripe Customer Portal/.test(dashboardHtml));
ok('dashboard JS hides Manage billing for complimentary grants', /manage\.hidden = hidePortal/.test(read('public/checkout.js')) && /Complimentary accounts do not use Stripe Customer Portal/.test(read('functions/api/billing/portal.js')));
ok('dashboard settings phone is the user number', /id="settings-phone"/.test(dashboardHtml) && /Not Treena’s shared bot number/.test(dashboardHtml) && /id="settings-retain"/.test(dashboardHtml) && !/id="settings-retain"[^>]*checked/.test(dashboardHtml));
ok('dashboard has no raw card fields', !/card number|last4|expir/i.test(dashboardHtml));
ok('dashboard threads empty state', /No threads yet\. Text Treena at \+12138653024\./.test(dashboardHtml));
ok('dashboard observability empty state', /Call details weren’t saved\. That’s the default\. Turn on save in account settings to keep transcripts and reports\./.test(dashboardHtml));
ok('dashboard directory index exists', existsSync(join(root, 'public/dashboard/index.html')));
ok('start name gate posts /api/account', /start-name-form/.test(read('public/checkout.js')) && /\/api\/account/.test(read('public/checkout.js')));

const namelessCustomer = {
  id: 'cus_test_123',
  name: null,
  phone: TEST_PHONE,
  metadata: {
    plan: 'personal',
    phone: TEST_PHONE,
    minutes: '30',
    retain_after_call: 'off',
  },
};
const namelessSession = {
  id: 'cs_test_abc',
  status: 'complete',
  payment_status: 'paid',
  mode: 'subscription',
  metadata: { plan: 'personal', email: 'tester@example.com', phone: TEST_PHONE },
  customer: 'cus_test_123',
  subscription: 'sub_test_123',
};
const namedSessionMock = mockStripe({
  customers: [tre20Customer],
  session: namelessSession,
});
const namedSession = await verifyCheckoutSession(syncEnv, 'cs_test_abc', namedSessionMock.fetchImpl);
ok('GET /api/session includes Stripe Customer.name', namedSession.ok && namedSession.name === 'Nathan Tester' && namedSession.firstName === 'Nathan');

const missingNameSession = await verifyCheckoutSession(syncEnv, 'cs_test_abc', mockStripe({
  customers: [namelessCustomer],
  session: namelessSession,
}).fetchImpl);
ok('session without Customer.name needs the start gate', missingNameSession.ok && !missingNameSession.name && !missingNameSession.firstName);

const fixtureThread = {
  event_id: 'evt_linq_1',
  chat_id: 'chat_1',
  sender: TEST_PHONE,
  verb: 'ask',
  inbound: { text: 'Can you call Publix about oat milk?' },
  kickoff: { verb: 'ask' },
  call: { status: 'completed', call_control_id: 'cc_1' },
};
const fixtureCall = {
  event_id: 'evt_linq_1',
  call_control_id: 'cc_1',
  status: 'completed',
  observability: {
    status: 'completed',
    duration_ms: 42000,
    hangup_path: 'remote',
    counts: { transcript_turns: 4, tool_calls: 1 },
  },
  call_report: { status: 'completed', duration_ms: 42000 },
  transcript: { turns: [{ role: 'assistant', text: 'Hi' }] },
};

let flyDashboardReq;
const dashMock = mockStripe({
  customers: [tre20Customer],
  session: namelessSession,
  dashboard: { ok: true, user: { ...mapped, first_name: 'Nathan', name: { first_name: 'Nathan', full_name: 'Nathan Tester' }, minutes_used: 0, minutes_included: 30 }, threads: [fixtureThread], calls: [fixtureCall] },
  onDashboard(req) { flyDashboardReq = req; },
});
const dash = await loadDashboard(syncEnv, 'cs_test_abc', dashMock.fetchImpl);
ok('HMAC GET /accounts/dashboard is wired', flyDashboardReq && flyDashboardReq.method === 'GET' && flyDashboardReq.url.startsWith(`${DEFAULT_DASHBOARD_URL}?phone=`) && flyDashboardReq.url.includes(encodeURIComponent(TEST_PHONE)));
ok('dashboard GET signs the E.164 phone', flyDashboardReq.headers[ACCOUNT_SYNC_SIGNATURE_HEADER] === await signAccountSync(syncSecret, TEST_PHONE));
ok('dashboard packages usage minutes + call count', dash.usage.minutesIncluded === 30 && dash.usage.minutesUsed === 0 && dash.usage.callCount === 1 && /update after calls/.test(dash.usage.usageNote));
ok('dashboard includes mocked thread + call_report', dash.threads.length === 1 && dash.calls.length === 1 && dash.calls[0].call_report.status === 'completed');
ok('dashboard billing follows TEST keys', dash.billing.test === true && dash.billing.badge === 'TEST' && dash.billing.noRealCharge === true && dash.billing.status === 'active');
ok('dashboard does not need name when Stripe Customer.name is set', dash.needsName === false && dash.firstName === 'Nathan');

const skippedDash = await getAccountDashboard(testEnv, TEST_PHONE, dashMock.fetchImpl);
ok('missing ACCOUNT_SYNC_SECRET returns empty threads/obs', skippedDash.skipped === true && Array.isArray(skippedDash.threads) && skippedDash.threads.length === 0 && skippedDash.calls.length === 0);

const previousFetchDash = globalThis.fetch;
globalThis.fetch = mockStripe({
  customers: [namelessCustomer],
  session: namelessSession,
  dashboard: { ok: true, user: null, threads: [], calls: [] },
}).fetchImpl;
try {
  const req = new Request('https://usetreena.com/api/dashboard?session_id=cs_test_abc');
  const res = await dashboardGet({ request: req, env: testEnv });
  const body = await res.json();
  ok('GET /api/dashboard empty arrays without Fly secret', res.status === 200 && body.ok === true && body.threads.length === 0 && body.calls.length === 0 && body.needsName === true);
} finally {
  globalThis.fetch = previousFetchDash;
}

const previousFetchBill = globalThis.fetch;
globalThis.fetch = mockStripe({
  customers: [tre20Customer],
  session: namelessSession,
  subscription: { id: 'sub_test_123', status: 'active' },
}).fetchImpl;
try {
  const req = new Request('https://usetreena.com/api/billing?session_id=cs_test_abc');
  const res = await billingGet({ request: req, env: testEnv });
  const body = await res.json();
  ok('GET /api/billing is Stripe TEST on test keys', res.status === 200 && body.mode === 'test' && body.badge === 'TEST' && body.noRealCharge === true && body.status === 'active');
} finally {
  globalThis.fetch = previousFetchBill;
}

let namedFly;
const namePosted = mockStripe({
  customers: [{ id: 'cus_existing', phone: TEST_PHONE, metadata: { plan: 'personal', phone: TEST_PHONE, minutes: '30', retain_after_call: 'off' } }],
  onFly(post) { namedFly = post; },
});
const namedSave = await saveAccountSettings(syncEnv, {
  email: 'tester@example.com',
  name: 'Nathan Tester',
  phone: TEST_PHONE,
  planId: 'personal',
  retainAfterCall: 'off',
  fetchImpl: namePosted.fetchImpl,
});
ok('POST /api/account name maps first_name + prefs.full_name', namedSave.ok === true && namedSave.firstName === 'Nathan' && JSON.parse(namedFly.body).first_name === 'Nathan' && JSON.parse(namedFly.body).prefs.full_name === 'Nathan Tester' && !('minutes_used' in JSON.parse(namedFly.body)));

const billed = await billingView(testEnv, namedSession, mockStripe({
  customers: [tre20Customer],
  session: namelessSession,
}).fetchImpl);
ok('billing view stays TEST on test keys', billed.mode === 'test' && billed.amountCents === 2000);

const liveBilled = await billingView(liveEnv, namedSession, mockStripe({
  live: true,
  customers: [tre20Customer],
  session: { ...namelessSession, id: 'cs_live_abc' },
}).fetchImpl);
ok('billing view is LIVE on live keys', liveBilled.mode === 'live' && liveBilled.live === true && liveBilled.badge === null && liveBilled.noRealCharge === false);
ok('billing omits dates when Stripe has none', billed.periodEnd == null && billed.renewsAt == null && billed.minutesResetAt == null);

const datedSub = {
  id: 'sub_test_123',
  status: 'active',
  current_period_start: 1789000000,
  current_period_end: 1791678400,
  cancel_at_period_end: false,
};
ok('unixToIso never invents a date', unixToIso(null) == null && unixToIso('') == null && unixToIso(0) == null);
ok('periodFromSubscription uses Stripe timestamps only', periodFromSubscription(datedSub).periodEnd === unixToIso(1791678400) && periodFromSubscription(datedSub).renewsAt === unixToIso(1791678400) && periodFromSubscription({}).periodEnd == null);
ok('periodFromSubscription reads item.current_period_end', periodFromSubscription({
  items: { data: [{ current_period_start: 1789000000, current_period_end: 1791678400 }] },
}).minutesResetAt === unixToIso(1791678400));
ok('cancel at period end does not invent renewsAt', periodFromSubscription({
  ...datedSub,
  cancel_at_period_end: true,
  cancel_at: 1791678400,
}).renewsAt == null && periodFromSubscription({
  ...datedSub,
  cancel_at_period_end: true,
  cancel_at: 1791678400,
}).cancelEffectiveAt === unixToIso(1791678400));

const portal = await createBillingPortalSession(testEnv, {
  customerId: 'cus_test_123',
  origin: 'https://usetreena.com',
  fetchImpl: mockStripe().fetchImpl,
});
ok('Stripe Customer Portal session URL', portal.ok === true && portal.url.startsWith('https://billing.stripe.com/'));

const canceled = await cancelSubscriptionAtPeriodEnd(testEnv, {
  subscriptionId: 'sub_test_123',
  fetchImpl: mockStripe({
    subscription: datedSub,
  }).fetchImpl,
});
ok('cancel plan is end-of-period with Stripe effective date', canceled.ok === true && canceled.cancelAtPeriodEnd === true && canceled.status === 'active' && canceled.cancelEffectiveAt === unixToIso(1791678400));

let reservedBot = false;
try {
  await saveAccountSettings(syncEnv, {
    email: 'tester@example.com',
    name: 'Nathan Tester',
    phone: DEFAULT_TREENA_IMESSAGE_E164,
    planId: 'personal',
    fetchImpl: mockStripe({ customers: [{ id: 'cus_existing' }] }).fetchImpl,
  });
} catch (error) {
  reservedBot = error.status === 400;
}
ok('settings reject Treena shared iMessage bot as user phone', reservedBot);

let reservedTelnyx = false;
try {
  await saveAccountSettings(syncEnv, {
    email: 'tester@example.com',
    name: 'Nathan Tester',
    phone: DEFAULT_TELNYX_FROM_E164,
    planId: 'personal',
    fetchImpl: mockStripe({ customers: [{ id: 'cus_existing' }] }).fetchImpl,
  });
} catch (error) {
  reservedTelnyx = error.status === 400;
}
ok('settings reject shared Telnyx FROM as user phone', reservedTelnyx);

try {
  assertUserPhone(TEST_PHONE);
  ok('user E.164 is accepted as account phone', true);
} catch {
  ok('user E.164 is accepted as account phone', false);
}

const unauthAccount = await accountPost({
  request: new Request('https://usetreena.com/api/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'personal', email: 'tester@example.com', name: 'Nathan Tester', phone: TEST_PHONE }),
  }),
  env: testEnv,
});
ok('POST /api/account without session is 401', unauthAccount.status === 401);

const authSecret = 'auth-session-secret';
const csrf = 'csrf-token-verify-1';
const authTok = await signPayload(authSecret, {
  email: 'tester@example.com',
  hasAccount: true,
  customerId: 'cus_test_123',
  phone: TEST_PHONE,
  csrf,
  exp: Math.floor(Date.now() / 1000) + 120,
});
const authCookie = `treena_auth=${encodeURIComponent(authTok)}`;
const authEnv = { ...testEnv, AUTH_SESSION_SECRET: authSecret };

const previousFetchPortal = globalThis.fetch;
globalThis.fetch = mockStripe({
  customers: [{ ...tre20Customer, email: 'tester@example.com' }],
  session: namelessSession,
  subscription: datedSub,
}).fetchImpl;
try {
  const missingCsrf = await billingCancelPost({
    request: new Request('https://usetreena.com/api/billing/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({}),
    }),
    env: authEnv,
  });
  ok('cancel without CSRF is 403', missingCsrf.status === 403);

  const cancelRes = await billingCancelPost({
    request: new Request('https://usetreena.com/api/billing/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: authCookie, 'X-Treena-CSRF': csrf },
      body: JSON.stringify({}),
    }),
    env: authEnv,
  });
  const cancelBody = await cancelRes.json();
  ok('POST /api/billing/cancel is end-of-period', cancelRes.status === 200 && cancelBody.cancelAtPeriodEnd === true && cancelBody.status === 'active' && cancelBody.cancelEffectiveAt === unixToIso(1791678400));

  const portalRes = await billingPortalPost({
    request: new Request('https://usetreena.com/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: authCookie, 'X-Treena-CSRF': csrf },
      body: JSON.stringify({}),
    }),
    env: authEnv,
  });
  const portalBody = await portalRes.json();
  ok('POST /api/billing/portal returns Stripe portal URL', portalRes.status === 200 && String(portalBody.url).startsWith('https://billing.stripe.com/'));

  const dashLoad = await dashboardGet({
    request: new Request('https://usetreena.com/api/dashboard', { headers: { Cookie: authCookie } }),
    env: authEnv,
  });
  const dashLoadBody = await dashLoad.json();
  const dashSetCookie = typeof dashLoad.headers.getSetCookie === 'function'
    ? dashLoad.headers.getSetCookie().join('; ')
    : (dashLoad.headers.get('Set-Cookie') || '');
  const dashAuth = (String(dashSetCookie).match(/treena_auth=[^;]+/) || [])[0] || authCookie;
  ok('GET /api/dashboard returns CSRF after load', dashLoad.status === 200 && dashLoadBody.csrf === csrf);

  const portalAfterLoad = await billingPortalPost({
    request: new Request('https://usetreena.com/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: dashAuth, 'X-Treena-CSRF': dashLoadBody.csrf },
      body: JSON.stringify({ csrf: dashLoadBody.csrf }),
    }),
    env: authEnv,
  });
  const portalAfterLoadBody = await portalAfterLoad.json();
  ok('Manage billing portal POST works after dashboard load', portalAfterLoad.status === 200 && String(portalAfterLoadBody.url).startsWith('https://billing.stripe.com/'));

  const portalBodyOnly = await billingPortalPost({
    request: new Request('https://usetreena.com/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ csrf }),
    }),
    env: authEnv,
  });
  const portalBodyOnlyJson = await portalBodyOnly.json();
  ok('portal POST accepts CSRF in JSON body', portalBodyOnly.status === 200 && String(portalBodyOnlyJson.url).startsWith('https://billing.stripe.com/'));

  const noCsrfTok = await signPayload(authSecret, {
    email: 'tester@example.com',
    hasAccount: true,
    customerId: 'cus_test_123',
    phone: TEST_PHONE,
    exp: Math.floor(Date.now() / 1000) + 120,
  });
  const noCsrfCookie = `treena_auth=${encodeURIComponent(noCsrfTok)}`;
  const meMint = await authOnRequest({
    request: new Request('https://usetreena.com/api/auth/me', { headers: { Cookie: noCsrfCookie } }),
    env: authEnv,
    params: { path: ['me'] },
  });
  const dashMint = await dashboardGet({
    request: new Request('https://usetreena.com/api/dashboard', { headers: { Cookie: noCsrfCookie } }),
    env: authEnv,
  });
  const meMintBody = await meMint.json();
  const dashMintBody = await dashMint.json();
  const meSetCookie = typeof meMint.headers.getSetCookie === 'function'
    ? meMint.headers.getSetCookie().join('; ')
    : (meMint.headers.get('Set-Cookie') || '');
  const meAuth = (String(meSetCookie).match(/treena_auth=[^;]+/) || [])[0];
  ok('auth/me and dashboard mint the same CSRF', Boolean(meMintBody.csrf) && meMintBody.csrf === dashMintBody.csrf);

  const portalLateCookie = await billingPortalPost({
    request: new Request('https://usetreena.com/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: meAuth, 'X-Treena-CSRF': dashMintBody.csrf },
      body: JSON.stringify({ csrf: dashMintBody.csrf }),
    }),
    env: authEnv,
  });
  const portalLateCookieBody = await portalLateCookie.json();
  ok('late /api/auth/me cookie still opens portal', portalLateCookie.status === 200 && String(portalLateCookieBody.url).startsWith('https://billing.stripe.com/'));
} finally {
  globalThis.fetch = previousFetchPortal;
}

const grantDashTok = await signPayload(authSecret, {
  email: 'nate@usetreena.com',
  hasAccount: false,
  complimentary: true,
  csrf,
  exp: Math.floor(Date.now() / 1000) + 120,
});
const grantDashCookie = `treena_auth=${encodeURIComponent(grantDashTok)}`;
const previousFetchGrant = globalThis.fetch;
const grantDashMock = mockStripe({ customers: [], subscriptions: [] });
globalThis.fetch = grantDashMock.fetchImpl;
try {
  const grantDashRes = await dashboardGet({
    request: new Request('https://usetreena.com/api/dashboard', { headers: { Cookie: grantDashCookie } }),
    env: { ...grantEnv, AUTH_SESSION_SECRET: authSecret },
  });
  const grantDashBody = await grantDashRes.json();
  ok('complimentary dashboard loads without a paid subscription', grantDashRes.status === 200 && grantDashBody.ok === true && grantDashBody.billing.complimentary === true && grantDashBody.billing.status === 'complimentary' && grantDashBody.billing.periodEnd == null && grantDashBody.billing.noRealCharge === true && grantDashBody.billing.plan === 'personal' && grantDashBody.billing.canManageBilling === false);

  const grantPortalRes = await billingPortalPost({
    request: new Request('https://usetreena.com/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: grantDashCookie, 'X-Treena-CSRF': csrf },
      body: JSON.stringify({}),
    }),
    env: { ...grantEnv, AUTH_SESSION_SECRET: authSecret },
  });
  const grantPortalBody = await grantPortalRes.json();
  ok('complimentary Manage billing is refused without Customer Portal', grantPortalRes.status === 403 && grantPortalBody.error === 'Complimentary accounts do not use Stripe Customer Portal');

  const grantPortalStale = await billingPortalPost({
    request: new Request('https://usetreena.com/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: grantDashCookie, 'X-Treena-CSRF': csrf },
      body: JSON.stringify({ sessionId: 'cs_test_stale' }),
    }),
    env: { ...grantEnv, AUTH_SESSION_SECRET: authSecret, STRIPE_SECRET_KEY: 'sk_live_verifier' },
  });
  const grantPortalStaleBody = await grantPortalStale.json();
  ok('complimentary portal does not require a live Checkout Session', grantPortalStale.status === 403 && grantPortalStaleBody.error === 'Complimentary accounts do not use Stripe Customer Portal' && !/Missing live Checkout Session/.test(JSON.stringify(grantPortalStaleBody)));
} finally {
  globalThis.fetch = previousFetchGrant;
}

ok('logged-in account holders leave / for dashboard', shouldRouteToDashboard({ hasAccount: true }, '/') === true && shouldRouteToDashboard({ hasAccount: true }, '/login') === true);
ok('logged-out visitors keep the landing', shouldRouteToDashboard({ hasAccount: false }, '/') === false && shouldRouteToDashboard(null, '/') === false);
ok('pricing is not redirected for account holders', shouldRouteToDashboard({ hasAccount: true }, '/pricing') === false);

const mwRedirect = await homeMiddleware({
  request: new Request('https://usetreena.com/', { headers: { Cookie: authCookie } }),
  env: authEnv,
  next: async () => new Response('landing'),
});
ok('middleware redirects / to /dashboard when hasAccount', mwRedirect.status === 302 && /\/dashboard$/.test(new URL(mwRedirect.headers.get('Location'), 'https://usetreena.com').pathname));

const mwNext = await homeMiddleware({
  request: new Request('https://usetreena.com/'),
  env: authEnv,
  next: async () => new Response('landing', { status: 200 }),
});
ok('middleware leaves logged-out / alone', mwNext.status === 200);

ok('Pages Functions: billing portal + cancel', existsSync(join(root, 'functions/api/billing/portal.js')) && existsSync(join(root, 'functions/api/billing/cancel.js')));
ok('home app.js routes signed-in accounts off the landing', /hasAccount/.test(read('public/app.js')) && /\/dashboard/.test(read('public/app.js')));
ok('home app.js ignores junk treena-session-id', /cs_\(test\|live\)_/.test(read('public/app.js')));
ok('start name save sends sessionId', /sessionId/.test(read('public/checkout.js')) && /\/api\/billing\/portal/.test(read('public/checkout.js')) && /\/api\/billing\/cancel/.test(read('public/checkout.js')));
ok('checkout JS sends portal CSRF header and JSON body', /X-Treena-CSRF/.test(read('public/checkout.js')) && /parsed.csrf = token/.test(read('public/checkout.js')) && /rememberCsrf\(me.csrf\)/.test(read('public/checkout.js')));
ok('start persists only real Checkout Session ids', /validCheckoutSessionId/.test(read('public/checkout.js')) && /persistCheckoutSessionId/.test(read('public/checkout.js')) && /localStorage\.setItem\(KEY\.session/.test(read('public/checkout.js')));

const persistEnv = { ...syncEnv, AUTH_SESSION_SECRET: authSecret };
const persistPaid = {
  id: 'cus_test_123',
  email: 'tester@example.com',
  name: 'Nathan Tester',
  phone: TEST_PHONE,
  metadata: { plan: 'personal', phone: TEST_PHONE, minutes: '30', retain_after_call: 'off' },
};
const previousFetchPersist = globalThis.fetch;
globalThis.fetch = mockStripe({
  customers: [persistPaid],
  subscription: { id: 'sub_test_123', status: 'active' },
  onFly() {},
}).fetchImpl;
try {
  const nameContinue = await accountPost({
    request: new Request('https://usetreena.com/api/account', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: authCookie, 'X-Treena-CSRF': csrf },
      body: JSON.stringify({
        sessionId: 'null',
        name: 'Nathan Tester',
        phone: TEST_PHONE,
        plan: 'personal',
        retainAfterCall: 'off',
      }),
    }),
    env: persistEnv,
  });
  const nameContinueBody = await nameContinue.json();
  ok('POST /api/account name Continue ignores junk session_id', nameContinue.status === 200 && nameContinueBody.ok === true && nameContinueBody.firstName === 'Nathan' && nameContinueBody.error !== 'Missing Checkout Session');

  const dashCookie = await dashboardGet({
    request: new Request('https://usetreena.com/api/dashboard?session_id=null', { headers: { Cookie: authCookie } }),
    env: persistEnv,
  });
  const dashCookieBody = await dashCookie.json();
  ok('GET /api/dashboard after pay does not require session_id', dashCookie.status === 200 && dashCookieBody.ok === true && dashCookieBody.needsName === false && dashCookieBody.firstName === 'Nathan' && dashCookieBody.error !== 'Missing Checkout Session');

  const startReentry = await sessionGet({
    request: new Request('https://usetreena.com/api/session?session_id=null', { headers: { Cookie: authCookie } }),
    env: persistEnv,
  });
  const startReentryBody = await startReentry.json();
  ok('GET /api/session re-entry uses the paid cookie', startReentry.status === 200 && startReentryBody.ok === true && startReentryBody.email === 'tester@example.com');

  const portalJunk = await billingPortalPost({
    request: new Request('https://usetreena.com/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: authCookie, 'X-Treena-CSRF': csrf },
      body: JSON.stringify({ sessionId: 'null' }),
    }),
    env: persistEnv,
  });
  const portalJunkBody = await portalJunk.json();
  ok('paid portal ignores junk session_id', portalJunk.status === 200 && String(portalJunkBody.url).startsWith('https://billing.stripe.com/'));
} finally {
  globalThis.fetch = previousFetchPersist;
}

const privacy = read('public/privacy.html') + read('public/privacy/index.html');
ok('privacy scare line is the lead', /<p class="page-lead">We don’t store anything unless you opt in\.<\/p>/.test(privacy));
ok('privacy locked body: opt-in store list', /call audio, transcripts, call history, and extra profile data/.test(privacy));
ok('privacy locked body: Telnyx; OpenAI pass-through', /Telnyx; OpenAI/.test(privacy) && /When you haven’t opted in, we don’t keep it/.test(privacy));
ok('privacy locked body: choose what to keep', /audio, transcript, and\/or history/.test(privacy));
ok('privacy locked body: first name not product name', /on behalf of your first name/.test(privacy) && /Treena doesn’t say the product name/.test(privacy));
ok('privacy explains saving and deletion choices', /You choose what to save, and you can ask us to delete what you’ve saved/.test(privacy));
ok('privacy contact mailto', /mailto:privacy@usetreena.com/.test(privacy));
ok('privacy quieter billing line is not the lead', /<p class="stub-note">We keep account login and minute totals for billing\.<\/p>/.test(privacy));
ok('privacy removed Ring five-claim blocks', !/Outbound calls/.test(privacy) && !/debugging\/quality/.test(privacy) && !/AI assistant/.test(privacy) && !/does not sell call content/.test(privacy) && !/\bDID\b/.test(privacy));
ok('privacy no HIPAA / she-her product', !/HIPAA/i.test(privacy) && !/\b(she|her|hers)\b/i.test(privacy));
ok('privacy chrome still Text Treena', /Text Treena/.test(privacy) && /class="[^"]*\bpage-main\b/.test(privacy));
ok('privacy directory index points How it works at home', /href="\.\.\/index\.html#how-it-works"/.test(read('public/privacy/index.html')));

const featureMap = read('docs/FEATURE_MAP.md');
const workingHome = readFileSync(join(root, 'public/index.html'));
const workingHomeSha = createHash('sha256').update(workingHome).digest('hex');
ok('FEATURE_MAP marks landing shipped / TRE-22 unfrozen', featureMap.includes('| `/` | `public/index.html` | shipped |') && /TRE-22 unfroze home/.test(featureMap) && !/Home is HOLD/.test(featureMap));
ok('FEATURE_MAP live home SHA is 9395-byte iMessage landing', featureMap.includes(LIVE_HOME_SHA) && /9395/.test(featureMap) && !/8868/.test(featureMap) && !/8b21a11d/.test(featureMap) && !/8610/.test(featureMap) && !/8760/.test(featureMap) && !/9256e977/.test(featureMap) && !/38ec609d/.test(featureMap) && !/8c84c3b9/.test(featureMap));
ok('FEATURE_MAP working-tree home SHA matches public/index.html', featureMap.includes(workingHomeSha) && featureMap.includes(String(workingHome.length)));
ok('FEATURE_MAP keeps iMessage subhead', featureMap.includes(IMESSAGE_LINE));
ok('FEATURE_MAP wave2 surfaces #17-#24', ['#17', '#18', '#19', '#20', '#21', '#22', '#23', '#24'].every((id) => featureMap.includes(`| ${id} |`)) && /skip as merge vehicle/.test(featureMap) && /Not dashboard product-live/.test(featureMap));
ok('FEATURE_MAP marks account TEST shipped', featureMap.includes('| `/account.html` | `public/account.html` | shipped |'));
ok('FEATURE_MAP records /login', featureMap.includes('| `/login.html` | `public/login.html` | shipped |'));
ok('FEATURE_MAP Stripe live Cap GO', /Cap GO/.test(featureMap) && /sk_live_/.test(featureMap) && /env-driven/.test(featureMap) && !/live Stripe flip is HOLD/.test(featureMap));
ok('FEATURE_MAP shared bot + user phone', /\+12138653024/.test(featureMap) && /Not a per-user Treena DID/.test(featureMap));
ok('FEATURE_MAP account is email+password not name', /email \+ password required/.test(featureMap) && !/\*\*name required\*\*/.test(featureMap) && /no `#name`/.test(featureMap));
ok('FEATURE_MAP name collected on start and settings copy', /name lives in account settings after signup/.test(featureMap) && featureMap.includes('| `/start.html` | `public/start.html` | shipped |') && /\| post-pay-name \| account \|.*\| shipped \|/.test(featureMap));
ok('FEATURE_MAP start keeps paid session through name Continue', /paid cookie/.test(featureMap) && /junk/.test(featureMap) && /session_id/.test(featureMap));
ok('FEATURE_MAP marks pay TEST shipped', featureMap.includes('| `/pay.html` | `public/pay.html` | shipped |'));
ok('FEATURE_MAP records Fly account sync', featureMap.includes('| account-fly-sync |') && /ACCOUNT_SYNC_SECRET/.test(featureMap) && /accounts\/sync/.test(featureMap));
ok('FEATURE_MAP Fly sync is sot-ready / not live', /\| account-fly-sync \| account \|.*\| sot-ready \|/.test(featureMap) && /Do not claim Fly sync live/.test(featureMap) && !/Pages deploy held/.test(featureMap) && !/not on the live Pages host/.test(featureMap) && !/not live Pages/.test(featureMap));
ok('FEATURE_MAP web does not write Neon', /does not write Neon/.test(featureMap) && /NEON_DATABASE_URL/.test(featureMap) && /sole writer of `users`/.test(featureMap));
ok('FEATURE_MAP checkout is env-driven live', /env-driven/.test(featureMap) && /STRIPE_WEBHOOK_SECRET/.test(featureMap) && !/Out of scope for Builder later: live Stripe and real auth/.test(featureMap));
ok('FEATURE_MAP records Apple Services ID + Google External', /com\.usetreena\.signin/.test(featureMap) && /External/.test(featureMap));
ok('checkout.js applies env stripe mode', /applyStripeMode/.test(read('public/checkout.js')));
ok('FEATURE_MAP marks privacy shipped', featureMap.includes('| `/privacy.html` | `public/privacy.html` | shipped |'));
ok('FEATURE_MAP privacy locked copy is the live page', /locked copy.*is live/.test(featureMap) && /We don’t store anything unless you opt in/.test(featureMap));
ok('FEATURE_MAP does not hold privacy for default-no-store', !/not live-shipped/.test(featureMap) && !/Do not deploy until Builder/.test(featureMap));
ok('FEATURE_MAP marks dashboard sot-ready on Pages', featureMap.includes('| `/dashboard.html` | `public/dashboard.html` | sot-ready |') && /Present on Pages GET `\/dashboard`/.test(featureMap) && /Cap has not GO/.test(featureMap) && /Cap not GO for product-live/.test(featureMap));
ok('FEATURE_MAP start is post-pay name then dashboard', /Post-pay name gate/.test(featureMap) && /required name form/.test(featureMap));
ok('FEATURE_MAP records HMAC dashboard GET', featureMap.includes('| account-fly-dashboard |') && /accounts\/dashboard/.test(featureMap) && /phone query value/.test(featureMap));
ok('FEATURE_MAP records billing period / portal / cancel / settings', featureMap.includes('| dashboard-billing-period |') && featureMap.includes('| dashboard-billing-portal |') && featureMap.includes('| dashboard-cancel-plan |') && featureMap.includes('| dashboard-account-settings |') && featureMap.includes('| dashboard-retain-persist |') && featureMap.includes('| logged-in-home-route |'));
ok('FEATURE_MAP OAuth advances past details to Review & pay', /advances to Review & pay/.test(featureMap) && /continuePathAfterIdentity/.test(featureMap));
ok('FEATURE_MAP complimentary grant is env-gated', featureMap.includes('| dashboard-complimentary-grant |') && /COMPLIMENTARY_ENTITLEMENT_EMAILS/.test(featureMap) && /no Stripe charge/.test(featureMap) && /no subscription/.test(featureMap));
ok('FEATURE_MAP logged-in accounts leave the landing', /routed to `\/dashboard`/.test(featureMap) && /not the landing/.test(featureMap));
ok('FEATURE_MAP omits minutes_used: 0', /`minutes_used` is omitted/.test(featureMap) && !/`minutes_used` is 0/.test(featureMap));

const agents = read('AGENTS.md');
ok('AGENTS.md points Cloud Agents at FEATURE_MAP + npm run verify', /FEATURE_MAP/.test(agents) && /npm run verify/.test(agents) && agents.includes(IMESSAGE_LINE));
ok('AGENTS.md records TRE-22 unfreeze and no name on account', /TRE-22/.test(agents) && /No `#name`/.test(agents) && /\/login/.test(agents) && /\+12138653024/.test(agents));
ok('CI runs npm run verify', /npm run verify/.test(read('.github/workflows/ci.yml')));

const liveOrigin = String(process.env.VERIFY_LIVE_ORIGIN || '').trim().replace(/\/+$/, '');
if (!liveOrigin) {
  console.log('ok  live GET / skipped (VERIFY_LIVE_ORIGIN unset; default CI path)');
} else {
  try {
    const res = await fetch(`${liveOrigin}/`);
    const body = Buffer.from(await res.arrayBuffer());
    const sha = createHash('sha256').update(body).digest('hex');
    const text = body.toString('utf8');
    ok('live GET / is HTTP 200', res.status === 200);
    ok('live GET / SHA matches FEATURE_MAP home', sha === LIVE_HOME_SHA && body.length === LIVE_HOME_BYTES, `got ${body.length} B ${sha}`);
    ok('live GET / has iMessage subhead', text.includes(IMESSAGE_LINE));
  } catch (error) {
    ok('live GET / via VERIFY_LIVE_ORIGIN', false, error.message);
  }
}

const secret = process.env.STRIPE_SECRET_KEY || '';
if (!secret) {
  console.log('ok  live Stripe Checkout skipped (STRIPE_SECRET_KEY unset; mock path is the verifier)');
} else if (secret.startsWith('sk_live_')) {
  ok('env Stripe key may be live', true);
  console.log('ok  live Stripe Checkout skipped (sk_live_ in env; verifier will not create a live session)');
} else if (!secret.startsWith('sk_test_')) {
  ok('env Stripe key is sk_test_ or sk_live_', false, 'expected sk_test_ or sk_live_ prefix');
} else {
  try {
    const live = await createCheckoutSession(
      {
        STRIPE_SECRET_KEY: secret,
        STRIPE_PRICE_PERSONAL: process.env.STRIPE_PRICE_PERSONAL,
        STRIPE_PRICE_PLUS: process.env.STRIPE_PRICE_PLUS,
      },
      {
        origin: 'https://usetreena.com',
        planId: 'personal',
        email: 'verifier@usetreena.com',
        name: 'Verifier',
        phone: '+14155552671',
      },
    );
    ok('optional Stripe TEST created a Checkout Session', String(live.id).startsWith('cs_test_') && Boolean(live.url));
  } catch (error) {
    ok('optional Stripe TEST created a Checkout Session', false, error.message);
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-paywall: all checks passed');

#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCheckoutSession, paidSessionView, saveAccountSettings, verifyCheckoutSession } from '../functions/_lib/checkout.js';
import { PLANS } from '../functions/_lib/plans.js';
import { requireTestSecret, verifyStripeWebhook } from '../functions/_lib/stripe.js';
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
import { DEFAULT_TREENA_IMESSAGE_E164, treenaIMessageView } from '../functions/_lib/imessage.js';
import { appleMissing, googleMissing, oauthStatus, signPayload, startAppleOAuth, startGoogleOAuth, verifyPayload } from '../functions/_lib/auth.js';
import { onRequest as authOnRequest } from '../functions/api/auth/[[path]].js';
import { onRequestPost as checkoutPost } from '../functions/api/checkout.js';
import { onRequestPost as accountPost } from '../functions/api/account.js';
import { onRequestGet as sessionGet } from '../functions/api/session.js';
import { onRequestGet as configGet } from '../functions/api/config.js';
import { onRequestPost as webhookPost } from '../functions/api/webhook.js';
import { onRequestGet as dashboardGet } from '../functions/api/dashboard.js';
import { onRequestGet as billingGet } from '../functions/api/billing.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_HOME_SHA = '8c84c3b942ec59982fcbb3836307a44f67ee67054845fce0ab273bd7a14a7e45';
const LIVE_HOME_BYTES = 8760;
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

function mockStripe({ customers = [], session, subscription, dashboard, onCheckout, onCustomer, onFly, onDashboard, flyStatus = 200, flyFailTimes = 0 } = {}) {
  const calls = [];
  let flyAttempts = 0;
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
        id: 'cs_test_abc',
        url: 'https://checkout.stripe.com/c/pay/cs_test_abc',
      });
    }
    if (url.includes('/v1/checkout/sessions/') && (init.method || 'GET') === 'GET') {
      return jsonResponse(session);
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

ok('home keeps iMessage line', read('public/index.html').includes(IMESSAGE_LINE));
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

const pricing = read('public/pricing.html') + read('public/pricing/index.html');
ok('pricing has Personal $20', /Personal/.test(pricing) && /\$20/.test(pricing) && /30 connected min/.test(pricing) && /\$0\.15/.test(pricing));
ok('pricing has Plus $40', /Plus/.test(pricing) && /\$40/.test(pricing) && /90/.test(pricing) && /\$0\.12/.test(pricing));
ok('pricing CTAs go to account with plan', /account\.html\?plan=personal/.test(pricing) && /account\.html\?plan=plus/.test(pricing));
ok('pricing cards do not jump to start', !/plan-card[\s\S]*start\.html/.test(pricing));
ok('no trial / free forever / annual / team / enterprise', !/\btrial\b/i.test(pricing.replace(/no trial/gi, '')) && !/free forever/i.test(pricing) && !/annual/i.test(pricing) && !/enterprise/i.test(pricing) && !/\bteam\b/i.test(pricing));

const pay = read('public/pay.html');
ok('pay posts to /api/checkout', /\/api\/checkout/.test(read('public/checkout.js')));
ok('start verifies /api/session', /\/api\/session/.test(read('public/checkout.js')));
ok('start name form is required after pay', /id="start-name-form"/.test(read('public/start.html')) && /id="name"/.test(read('public/start.html')) && /required/.test(read('public/start.html')));
ok('dashboard fetches /api/dashboard', /\/api\/dashboard/.test(read('public/checkout.js')));
ok('pay no longer marks paid locally', !/KEY\.paid|treena-stub-paid|setItem\([^)]*paid/.test(read('public/checkout.js')));
ok('start page waits for Stripe session', /session_id/.test(read('public/checkout.js')) && /start-ready/.test(read('public/start.html')));
ok('pay copy says no trial', /No trial/.test(pay));
ok('pay mentions Stripe TEST card', /4242 4242 4242 4242/.test(pay));

ok('Pages Functions: checkout', existsSync(join(root, 'functions/api/checkout.js')));
ok('Pages Functions: session', existsSync(join(root, 'functions/api/session.js')));
ok('Pages Functions: webhook', existsSync(join(root, 'functions/api/webhook.js')));
ok('Pages Functions: dashboard', existsSync(join(root, 'functions/api/dashboard.js')));
ok('Pages Functions: billing TEST', existsSync(join(root, 'functions/api/billing.js')));
ok('Pages Functions helpers are private (_lib)', existsSync(join(root, 'functions/_lib/checkout.js')));
ok('locked plans are Personal $20 and Plus $40', PLANS.personal.amountCents === 2000 && PLANS.plus.amountCents === 4000 && Object.keys(PLANS).length === 2);

let liveRejected = false;
try {
  requireTestSecret('sk_live_nope');
} catch (error) {
  liveRejected = error.message === 'Live Stripe keys are not allowed';
}
ok('reject live Stripe secret', liveRejected);

let missingRejected = false;
try {
  requireTestSecret('');
} catch (error) {
  missingRejected = error.status === 503;
}
ok('missing Stripe secret is 503', missingRejected);

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
  liveSession = error.message.includes('Live Checkout');
}
ok('live Checkout Sessions rejected', liveSession);

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
ok('GET /api/config is TEST-only', configRes.status === 200 && configBody.mode === 'test' && configBody.configured === true && configBody.stripeLive === false);
ok('publishable key is pk_test_', String(configBody.publishableKey || '').startsWith('pk_test_'));
ok('config publishes shared iMessage DID', configBody.imessage && configBody.imessage.e164 === '+12138653024' && configBody.imessage.smsUrl === 'sms:+12138653024' && configBody.imessage.shared === true);

const liveConfig = await configGet({
  request: new Request('https://usetreena.com/api/config'),
  env: { STRIPE_SECRET_KEY: 'sk_live_nope', STRIPE_PUBLISHABLE_KEY: 'pk_test_x' },
});
ok('config rejects live secret', configRes.status === 200 && liveConfig.status === 500);

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
  customers: [{ id: 'cus_existing', phone: TEST_PHONE, metadata: { plan: 'personal', phone: TEST_PHONE, minutes: '30', retain_after_call: 'off' } }],
  onFly() {},
}).fetchImpl;
try {
  const req = new Request('https://usetreena.com/api/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'personal', email: 'tester@example.com', name: 'Nathan Tester', phone: TEST_PHONE, retainAfterCall: 'off' }),
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
ok('Text Treena CTAs use the sandbox DID', /sms:\+12138653024/.test(read('public/index.html')) && /sms:\+12138653024/.test(read('public/login.html')) && read('public/imessage.js').includes(DEFAULT_TREENA_IMESSAGE_E164));
ok('account phone is the user number, not a Treena DID', /Not Treena’s shared bot number/.test(read('public/account.html')) && !/per-user Treena DID/.test(read('public/account.html')));
ok('imessage helper defaults to Cap DID', treenaIMessageView({}).e164 === '+12138653024' && treenaIMessageView({ PUBLIC_TREENA_IMESSAGE_E164: '+14155550100' }).e164 === '+14155550100');

const googleMissingKeys = googleMissing({});
ok('google missing names GOOGLE_CLIENT_ID + secret + AUTH_SESSION_SECRET', googleMissingKeys.includes('GOOGLE_CLIENT_ID') && googleMissingKeys.includes('GOOGLE_CLIENT_SECRET') && googleMissingKeys.includes('AUTH_SESSION_SECRET'));
ok('apple missing names Apple + AUTH_SESSION_SECRET', appleMissing({}).includes('APPLE_CLIENT_ID') && appleMissing({}).includes('APPLE_PRIVATE_KEY') && appleMissing({}).includes('AUTH_SESSION_SECRET'));
ok('oauth status is false without secrets', oauthStatus({}).google === false && oauthStatus({}).apple === false);

const googleBlocked = await startGoogleOAuth({}, new Request('https://usetreena.com/api/auth/google'));
ok('google start without secrets redirects to /login with missing keys', googleBlocked.status === 302 && /login\.html/.test(googleBlocked.headers.get('Location')) && /GOOGLE_CLIENT_ID/.test(googleBlocked.headers.get('Location')));
const appleBlocked = await startAppleOAuth({}, new Request('https://usetreena.com/api/auth/apple'));
ok('apple start without secrets redirects to /login with missing keys', appleBlocked.status === 302 && /APPLE_CLIENT_ID/.test(appleBlocked.headers.get('Location')));

const googleReady = await startGoogleOAuth({
  GOOGLE_CLIENT_ID: 'treena.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  AUTH_SESSION_SECRET: 'auth-session-secret',
}, new Request('https://usetreena.com/api/auth/google'));
ok('google start with secrets redirects to Google', googleReady.status === 302 && String(googleReady.headers.get('Location')).startsWith('https://accounts.google.com/o/oauth2/v2/auth'));

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
ok('dashboard has four sections', /id="usage"/.test(dashboardHtml) && /id="billing"/.test(dashboardHtml) && /id="threads"/.test(dashboardHtml) && /id="observability"/.test(dashboardHtml));
ok('dashboard billing TEST badge', /class="test-badge">TEST/.test(dashboardHtml) && /No real charge/.test(dashboardHtml));
ok('dashboard usage minutes + calls', /data-minutes-included/.test(dashboardHtml) && /data-minutes-used/.test(dashboardHtml) && /data-call-count/.test(dashboardHtml) && /Usage totals update after calls/.test(dashboardHtml));
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
ok('dashboard billing is TEST', dash.billing.test === true && dash.billing.badge === 'TEST' && dash.billing.noRealCharge === true && dash.billing.status === 'active');
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
  ok('GET /api/billing is Stripe TEST', res.status === 200 && body.mode === 'test' && body.badge === 'TEST' && body.noRealCharge === true && body.status === 'active');
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
ok('billing view stays TEST-only', billed.mode === 'test' && billed.amountCents === 2000);

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
ok('FEATURE_MAP marks landing shipped / TRE-22 unfrozen', featureMap.includes('| `/` | `public/index.html` | shipped |') && /TRE-22 unfroze home/.test(featureMap) && !/Home is HOLD/.test(featureMap));
ok('FEATURE_MAP live home SHA is 8760-byte iMessage landing', featureMap.includes(LIVE_HOME_SHA) && /8760/.test(featureMap) && !/8610/.test(featureMap) && !/9256e977/.test(featureMap) && !/38ec609d/.test(featureMap));
ok('FEATURE_MAP keeps iMessage subhead', featureMap.includes(IMESSAGE_LINE));
ok('FEATURE_MAP marks account TEST shipped', featureMap.includes('| `/account.html` | `public/account.html` | shipped |'));
ok('FEATURE_MAP records /login', featureMap.includes('| `/login.html` | `public/login.html` | shipped |'));
ok('FEATURE_MAP Stripe live HOLD', /live Stripe flip is HOLD/.test(featureMap));
ok('FEATURE_MAP shared bot + user phone', /\+12138653024/.test(featureMap) && /Not a per-user Treena DID/.test(featureMap));
ok('FEATURE_MAP account is email+password not name', /email \+ password required/.test(featureMap) && !/\*\*name required\*\*/.test(featureMap) && /no `#name`/.test(featureMap));
ok('FEATURE_MAP name collected on start and settings copy', /name lives in account settings after signup/.test(featureMap) && featureMap.includes('| `/start.html` | `public/start.html` | shipped |') && /\| post-pay-name \| account \|.*\| shipped \|/.test(featureMap));
ok('FEATURE_MAP marks pay TEST shipped', featureMap.includes('| `/pay.html` | `public/pay.html` | shipped |'));
ok('FEATURE_MAP records Fly account sync', featureMap.includes('| account-fly-sync |') && /ACCOUNT_SYNC_SECRET/.test(featureMap) && /accounts\/sync/.test(featureMap));
ok('FEATURE_MAP Fly sync is sot-ready / not live', /\| account-fly-sync \| account \|.*\| sot-ready \|/.test(featureMap) && /Do not claim Fly sync live/.test(featureMap) && !/Pages deploy held/.test(featureMap) && !/not on the live Pages host/.test(featureMap) && !/not live Pages/.test(featureMap));
ok('FEATURE_MAP web does not write Neon', /does not write Neon/.test(featureMap) && /NEON_DATABASE_URL/.test(featureMap) && /sole writer of `users`/.test(featureMap));
ok('FEATURE_MAP no longer says live Stripe is out of scope for TEST', /Stripe TEST/.test(featureMap) && !/Out of scope for Builder later: live Stripe and real auth/.test(featureMap));
ok('FEATURE_MAP marks privacy shipped', featureMap.includes('| `/privacy.html` | `public/privacy.html` | shipped |'));
ok('FEATURE_MAP privacy locked copy is the live page', /locked copy.*is live/.test(featureMap) && /We don’t store anything unless you opt in/.test(featureMap));
ok('FEATURE_MAP does not hold privacy for default-no-store', !/not live-shipped/.test(featureMap) && !/Do not deploy until Builder/.test(featureMap));
ok('FEATURE_MAP marks dashboard sot-ready on Pages', featureMap.includes('| `/dashboard.html` | `public/dashboard.html` | sot-ready |') && /Present on Pages GET `\/dashboard`/.test(featureMap) && /Cap has not GO/.test(featureMap) && /Cap not GO for product-live/.test(featureMap));
ok('FEATURE_MAP start is post-pay name then dashboard', /Post-pay name gate/.test(featureMap) && /required name form/.test(featureMap));
ok('FEATURE_MAP records HMAC dashboard GET', featureMap.includes('| account-fly-dashboard |') && /accounts\/dashboard/.test(featureMap) && /phone query value/.test(featureMap));
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
  console.log('ok  live Stripe TEST skipped (STRIPE_SECRET_KEY unset; mock path is the verifier)');
} else if (secret.startsWith('sk_live_')) {
  ok('env Stripe key is TEST-only', false, 'sk_live_ is not allowed');
} else if (!secret.startsWith('sk_test_')) {
  ok('env Stripe key is TEST-only', false, 'expected sk_test_ prefix');
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
    ok('live Stripe TEST created a Checkout Session', String(live.id).startsWith('cs_test_') && Boolean(live.url));
  } catch (error) {
    ok('live Stripe TEST created a Checkout Session', false, error.message);
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-paywall: all checks passed');

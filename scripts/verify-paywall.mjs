#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCheckoutSession, paidSessionView, saveAccountSettings, verifyCheckoutSession } from '../functions/_lib/checkout.js';
import { PLANS } from '../functions/_lib/plans.js';
import { requireTestSecret, verifyStripeWebhook } from '../functions/_lib/stripe.js';
import {
  ACCOUNT_SYNC_SIGNATURE_HEADER,
  DEFAULT_SYNC_URL,
  accountSyncUrl,
  firstNameFrom,
  payloadFromStripeCustomer,
  postAccountSync,
  signAccountSync,
  syncFromStripeEvent,
} from '../functions/_lib/sync.js';
import { onRequestPost as checkoutPost } from '../functions/api/checkout.js';
import { onRequestPost as accountPost } from '../functions/api/account.js';
import { onRequestGet as sessionGet } from '../functions/api/session.js';
import { onRequestGet as configGet } from '../functions/api/config.js';
import { onRequestPost as webhookPost } from '../functions/api/webhook.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const frozenHome = ['public/app.js'];
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

function gitDiff(files) {
  try {
    return execFileSync('git', ['diff', 'HEAD', '--', ...files], { cwd: root, encoding: 'utf8' });
  } catch (error) {
    return String(error.stdout || error.message || error);
  }
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

function mockStripe({ customers = [], session, onCheckout, onCustomer, onFly, flyStatus = 200, flyFailTimes = 0 } = {}) {
  const calls = [];
  let flyAttempts = 0;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body || '', headers: init.headers || {} });
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
    return jsonResponse({ error: { message: `unexpected Stripe call ${url}` } }, 500);
  };
  return { fetchImpl, calls };
}

const testEnv = {
  STRIPE_SECRET_KEY: 'sk_test_verifier',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_verifier',
};

ok('home animation behavior unchanged', gitDiff(frozenHome).trim() === '', gitDiff(frozenHome).slice(0, 400));
// The only authorized homepage markup change is routing its existing CTAs to setup.
const originalHome = execFileSync('git', ['show', 'HEAD:public/index.html'], { cwd: root, encoding: 'utf8' });
const expectedHome = originalHome.replace(/(<nav aria-label="Main navigation">)(.*?)(<\/nav>)/s, (_, open, body, close) => {
  const links = [...body.matchAll(/<a\b[^>]*>.*?<\/a>/gs)].map(match => match[0]);
  return open + ['Pricing', 'Privacy', 'How it works', 'What it can do'].map(label => links.find(link => link.endsWith(`>${label}</a>`))).join('') + close;
}).replace('</head>', (originalHome.includes('motion.css') ? '</head>' : '<link rel="stylesheet" href="motion.css?v=20260912-motion1">\n</head>')).replaceAll('<button class="button primary text-relay">Text Treena</button>', '<a class="button primary" href="account.html?plan=personal">Text Treena</a>');
ok('home layout unchanged except authorized CTA destinations and transition stylesheet', read('public/index.html') === expectedHome);
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
  'public/checkout.js',
  'public/index.html',
  'public/app.js',
];
const publicBlob = publicFiles.map(read).join('\n');
ok('no stub banners in checkout pages', !/Stub —/.test(read('public/account.html') + read('public/pay.html') + read('public/start.html')));
ok('no Stripe secret in public/', !/sk_test_|sk_live_|whsec_/.test(publicBlob));
ok('no live publishable key in public/', !/pk_live_/.test(publicBlob));
ok('home does not restyle via this change', /You text\./.test(read('public/index.html')) && /Watch a call/.test(read('public/index.html')));

const pricing = read('public/pricing.html') + read('public/pricing/index.html');
ok('pricing has Personal $20', /Personal/.test(pricing) && /\$20/.test(pricing) && /30 connected min/.test(pricing) && /\$0\.15/.test(pricing));
ok('pricing has Plus $40', /Plus/.test(pricing) && /\$40/.test(pricing) && /90/.test(pricing) && /\$0\.12/.test(pricing));
ok('pricing CTAs go to account with plan', /account\.html\?plan=personal/.test(pricing) && /account\.html\?plan=plus/.test(pricing));
ok('pricing cards do not jump to start', !/plan-card[\s\S]*start\.html/.test(pricing));
ok('no trial / free forever / annual / team / enterprise', !/\btrial\b/i.test(pricing.replace(/no trial/gi, '')) && !/free forever/i.test(pricing) && !/annual/i.test(pricing) && !/enterprise/i.test(pricing) && !/\bteam\b/i.test(pricing));

const pay = read('public/pay.html');
ok('pay posts to /api/checkout', /\/api\/checkout/.test(read('public/checkout.js')));
ok('start verifies /api/session', /\/api\/session/.test(read('public/checkout.js')));
ok('pay no longer marks paid locally', !/KEY\.paid|treena-stub-paid|setItem\([^)]*paid/.test(read('public/checkout.js')));
ok('start page waits for Stripe session', /session_id/.test(read('public/checkout.js')) && /start-ready/.test(read('public/start.html')));
ok('pay copy says no trial', /No trial/.test(pay));
ok('pay mentions Stripe TEST card', /4242 4242 4242 4242/.test(pay));

ok('Pages Functions: checkout', existsSync(join(root, 'functions/api/checkout.js')));
ok('Pages Functions: session', existsSync(join(root, 'functions/api/session.js')));
ok('Pages Functions: webhook', existsSync(join(root, 'functions/api/webhook.js')));
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
ok('GET /api/config is TEST-only', configRes.status === 200 && configBody.mode === 'test' && configBody.configured === true);
ok('publishable key is pk_test_', String(configBody.publishableKey || '').startsWith('pk_test_'));

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
  && mapped.minutes_used === 0
  && mapped.retain_call_artifacts === false
  && mapped.stripe_customer_id === 'cus_test_123');
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
ok('FEATURE_MAP marks account TEST shipped', featureMap.includes('| `/account.html` | `public/account.html` | shipped |'));
ok('FEATURE_MAP account is email+password not name', /email \+ password required/.test(featureMap) && !/\*\*name required\*\*/.test(featureMap));
ok('FEATURE_MAP marks pay TEST shipped', featureMap.includes('| `/pay.html` | `public/pay.html` | shipped |'));
ok('FEATURE_MAP records Fly account sync', featureMap.includes('| account-fly-sync |') && /ACCOUNT_SYNC_SECRET/.test(featureMap) && /accounts\/sync/.test(featureMap));
ok('FEATURE_MAP Fly sync is sot-ready / not live', /\| account-fly-sync \| account \|.*\| sot-ready \|/.test(featureMap) && /Do not claim live/.test(featureMap) && /Pages deploy held/.test(featureMap));
ok('FEATURE_MAP web does not write Neon', /does not write Neon/.test(featureMap) && /NEON_DATABASE_URL/.test(featureMap) && /sole writer of `users`/.test(featureMap));
ok('FEATURE_MAP no longer says live Stripe is out of scope for TEST', /Stripe TEST/.test(featureMap) && !/Out of scope for Builder later: live Stripe and real auth/.test(featureMap));
ok('FEATURE_MAP marks privacy shipped', featureMap.includes('| `/privacy.html` | `public/privacy.html` | shipped |'));
ok('FEATURE_MAP privacy locked copy is the live page', /locked copy.*is live/.test(featureMap) && /We don’t store anything unless you opt in/.test(featureMap));
ok('FEATURE_MAP does not hold privacy for default-no-store', !/not live-shipped/.test(featureMap) && !/Do not deploy until Builder/.test(featureMap));
ok('FEATURE_MAP home HOLD / iMessage unchanged', /Home is HOLD/.test(featureMap) && /iMessage line are unchanged/.test(featureMap));

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

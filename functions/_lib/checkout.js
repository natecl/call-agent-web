import { getPlan } from './plans.js';
import { assertPhone } from './phone.js';
import { normalizeRetain } from './retain.js';
import { encodeForm, stripeRequest } from './stripe.js';
import { payloadFromStripeCustomer, postAccountSync } from './sync.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(value)) {
    const err = new Error('A valid email is required');
    err.status = 400;
    throw err;
  }
  return value;
}

function customerFields({ email, name, phone, plan, retainAfterCall }) {
  return {
    email,
    name: name || undefined,
    phone,
    'metadata[plan]': plan.id,
    'metadata[phone]': phone,
    'metadata[minutes]': String(plan.minutes),
    'metadata[retain_after_call]': retainAfterCall,
    'metadata[source]': 'usetreena-pages-test',
  };
}

export async function findOrCreateCustomer(env, { email, name, phone, plan, retainAfterCall, fetchImpl }) {
  const listed = await stripeRequest(env, {
    method: 'GET',
    path: `customers?email=${encodeURIComponent(email)}&limit=1`,
    fetchImpl,
  });
  const existing = listed.data && listed.data[0];
  const form = encodeForm(customerFields({ email, name, phone, plan, retainAfterCall }));
  if (existing && existing.id) {
    return stripeRequest(env, {
      method: 'POST',
      path: `customers/${encodeURIComponent(existing.id)}`,
      form,
      fetchImpl,
    });
  }
  return stripeRequest(env, { method: 'POST', path: 'customers', form, fetchImpl });
}

export async function saveAccountSettings(env, { email, name, phone, planId, retainAfterCall, fetchImpl }) {
  const plan = getPlan(planId);
  if (!plan) {
    const err = new Error('Choose Personal or Plus');
    err.status = 400;
    throw err;
  }
  const normalizedEmail = assertEmail(email);
  const normalizedPhone = assertPhone(phone);
  const retain = normalizeRetain(retainAfterCall);
  const trimmedName = String(name || '').trim();
  const listed = await stripeRequest(env, {
    method: 'GET',
    path: `customers?email=${encodeURIComponent(normalizedEmail)}&limit=1`,
    fetchImpl,
  });
  const existing = listed.data && listed.data[0];
  if (!existing || !existing.id) {
    const err = new Error('No Stripe TEST account for this email');
    err.status = 404;
    throw err;
  }
  const customer = await stripeRequest(env, {
    method: 'POST',
    path: `customers/${encodeURIComponent(existing.id)}`,
    form: encodeForm(customerFields({
      email: normalizedEmail,
      name: trimmedName,
      phone: normalizedPhone,
      plan,
      retainAfterCall: retain,
    })),
    fetchImpl,
  });
  const merged = {
    ...existing,
    ...customer,
    id: customer.id || existing.id,
    name: trimmedName || customer.name || existing.name || '',
    phone: normalizedPhone,
    metadata: {
      ...(existing.metadata || {}),
      ...(customer.metadata || {}),
      plan: plan.id,
      phone: normalizedPhone,
      minutes: String(plan.minutes),
      retain_after_call: retain,
    },
  };
  const sync = await postAccountSync(
    env,
    payloadFromStripeCustomer(merged, { eventCreated: Date.now() / 1000 }),
    fetchImpl,
    { required: true },
  );
  return {
    ok: true,
    customerId: merged.id,
    plan: plan.id,
    minutes: plan.minutes,
    phone: normalizedPhone,
    retainAfterCall: retain,
    sync,
  };
}

export function checkoutForm({ origin, plan, email, name, phone, retainAfterCall, customerId, priceId }) {
  const successUrl = `${origin}/start.html?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan.id)}`;
  const cancelUrl = `${origin}/pay.html?plan=${encodeURIComponent(plan.id)}`;
  const fields = {
    mode: 'subscription',
    customer: customerId,
    client_reference_id: plan.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'metadata[plan]': plan.id,
    'metadata[email]': email,
    'metadata[name]': name || undefined,
    'metadata[phone]': phone,
    'metadata[minutes]': String(plan.minutes),
    'metadata[retain_after_call]': retainAfterCall,
    'subscription_data[metadata][plan]': plan.id,
    'subscription_data[metadata][minutes]': String(plan.minutes),
    'subscription_data[metadata][overage]': plan.overage,
    'subscription_data[metadata][email]': email,
    'subscription_data[metadata][phone]': phone,
    'subscription_data[metadata][retain_after_call]': retainAfterCall,
  };
  if (priceId) {
    fields['line_items[0][price]'] = priceId;
  } else {
    fields['line_items[0][price_data][currency]'] = 'usd';
    fields['line_items[0][price_data][unit_amount]'] = String(plan.amountCents);
    fields['line_items[0][price_data][recurring][interval]'] = 'month';
    fields['line_items[0][price_data][product_data][name]'] = plan.productName;
    fields['line_items[0][price_data][product_data][description]'] = plan.productDescription;
  }
  return encodeForm(fields);
}

export async function createCheckoutSession(env, { origin, planId, email, name, phone, retainAfterCall, fetchImpl }) {
  const plan = getPlan(planId);
  if (!plan) {
    const err = new Error('Choose Personal or Plus');
    err.status = 400;
    throw err;
  }
  const normalizedEmail = assertEmail(email);
  const normalizedPhone = assertPhone(phone);
  const retain = normalizeRetain(retainAfterCall);
  const trimmedName = String(name || '').trim();
  const customer = await findOrCreateCustomer(env, {
    email: normalizedEmail,
    name: trimmedName,
    phone: normalizedPhone,
    plan,
    retainAfterCall: retain,
    fetchImpl,
  });
  const priceId = env[plan.priceEnv] || '';
  const form = checkoutForm({
    origin,
    plan,
    email: normalizedEmail,
    name: trimmedName,
    phone: normalizedPhone,
    retainAfterCall: retain,
    customerId: customer.id,
    priceId,
  });
  if (form.has('subscription_data[trial_period_days]')) {
    const err = new Error('Trial is not allowed');
    err.status = 500;
    throw err;
  }
  const session = await stripeRequest(env, {
    method: 'POST',
    path: 'checkout/sessions',
    form,
    fetchImpl,
  });
  if (!session.url) {
    const err = new Error('Stripe Checkout URL missing');
    err.status = 502;
    throw err;
  }
  return {
    id: session.id,
    url: session.url,
    plan: plan.id,
    minutes: plan.minutes,
    phone: normalizedPhone,
    retainAfterCall: retain,
    customerId: customer.id,
  };
}

export function paidSessionView(session) {
  const planId = (session.metadata && session.metadata.plan) || session.client_reference_id;
  const plan = getPlan(planId);
  if (!plan) {
    const err = new Error('Unknown plan on Checkout Session');
    err.status = 400;
    throw err;
  }
  const complete = session.status === 'complete';
  const paid = session.payment_status === 'paid';
  if (!complete || !paid) {
    const err = new Error('Payment is not complete');
    err.status = 402;
    throw err;
  }
  if (session.mode && session.mode !== 'subscription') {
    const err = new Error('Checkout Session is not a subscription');
    err.status = 400;
    throw err;
  }
  const phone = assertPhone(session.metadata && session.metadata.phone);
  const retainAfterCall = normalizeRetain(session.metadata && session.metadata.retain_after_call);
  return {
    ok: true,
    plan: plan.id,
    minutes: plan.minutes,
    overage: plan.overage,
    retainAfterCall,
    phone,
    email: (session.metadata && session.metadata.email) || session.customer_email || null,
    customerId: typeof session.customer === 'string' ? session.customer : session.customer && session.customer.id,
    subscriptionId: typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription && session.subscription.id,
    sessionId: session.id,
  };
}

export async function verifyCheckoutSession(env, sessionId, fetchImpl) {
  const id = String(sessionId || '').trim();
  if (id.startsWith('cs_live_')) {
    const err = new Error('Live Checkout Sessions are not allowed');
    err.status = 400;
    throw err;
  }
  if (!id.startsWith('cs_test_')) {
    const err = new Error('Missing Checkout Session');
    err.status = 400;
    throw err;
  }
  const session = await stripeRequest(env, {
    method: 'GET',
    path: `checkout/sessions/${encodeURIComponent(id)}`,
    fetchImpl,
  });
  return paidSessionView(session);
}

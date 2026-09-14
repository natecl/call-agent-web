import { getPlan } from './plans.js';
import { assertPhone, assertUserPhone } from './phone.js';
import { normalizeRetain } from './retain.js';
import { assertCheckoutSessionId, encodeForm, requireStripeSecret, stripeRequest } from './stripe.js';
import { assertName, firstNameFrom, payloadFromStripeCustomer, postAccountSync } from './sync.js';
import { MINUTE_PACK_KIND, PACK_AMOUNT_CENTS, PACK_MAX_MINUTES, PACK_MINUTES, PACK_PRODUCT_DESCRIPTION, PACK_PRODUCT_NAME, MINUTE_PACK_PRICE_ENV, minutePackView } from './usage.js';

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
    'metadata[source]': 'usetreena-pages',
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

export async function saveAccountSettings(env, { email, name, phone, planId, retainAfterCall, customerId, fetchImpl }) {
  const normalizedEmail = assertEmail(email);
  const normalizedPhone = assertUserPhone(phone, env);
  const retain = normalizeRetain(retainAfterCall);
  const named = assertName(name);
  let existing;
  if (customerId) {
    existing = await stripeRequest(env, {
      method: 'GET',
      path: `customers/${encodeURIComponent(customerId)}`,
      fetchImpl,
    });
    const existingEmail = String((existing && existing.email) || '').trim().toLowerCase();
    if (existingEmail && existingEmail !== normalizedEmail) {
      const err = new Error('This account belongs to a different email');
      err.status = 403;
      throw err;
    }
  } else {
    const listed = await stripeRequest(env, {
      method: 'GET',
      path: `customers?email=${encodeURIComponent(normalizedEmail)}&limit=1`,
      fetchImpl,
    });
    existing = listed.data && listed.data[0];
  }
  if (!existing || !existing.id) {
    const err = new Error('No Stripe account for this email');
    err.status = 404;
    throw err;
  }
  const existingPlan = getPlan((existing.metadata && existing.metadata.plan) || planId);
  const plan = getPlan(planId) || existingPlan;
  if (!plan) {
    const err = new Error('Choose Personal or Plus');
    err.status = 400;
    throw err;
  }
  const customer = await stripeRequest(env, {
    method: 'POST',
    path: `customers/${encodeURIComponent(existing.id)}`,
    form: encodeForm(customerFields({
      email: normalizedEmail,
      name: named.name,
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
    name: named.name || customer.name || existing.name || '',
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
    name: named.name,
    firstName: named.firstName,
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
  const normalizedPhone = assertUserPhone(phone, env);
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

export function minutePackCheckoutForm({ origin, customerId, email, phone, priceId }) {
  const fields = {
    mode: 'payment',
    customer: customerId,
    client_reference_id: MINUTE_PACK_KIND,
    success_url: `${origin}/dashboard.html?pack=ok`,
    cancel_url: `${origin}/dashboard.html`,
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'metadata[kind]': MINUTE_PACK_KIND,
    'metadata[minutes]': String(PACK_MINUTES),
    'metadata[amount_cents]': String(PACK_AMOUNT_CENTS),
    'metadata[max_prepaid_minutes]': String(PACK_MAX_MINUTES),
    'metadata[email]': email || undefined,
    'metadata[phone]': phone || undefined,
  };
  if (priceId) {
    fields['line_items[0][price]'] = priceId;
  } else {
    fields['line_items[0][price_data][currency]'] = 'usd';
    fields['line_items[0][price_data][unit_amount]'] = String(PACK_AMOUNT_CENTS);
    fields['line_items[0][price_data][product_data][name]'] = PACK_PRODUCT_NAME;
    fields['line_items[0][price_data][product_data][description]'] = PACK_PRODUCT_DESCRIPTION;
  }
  return encodeForm(fields);
}

export async function createMinutePackCheckout(env, {
  origin,
  customerId,
  email,
  phone,
  prepaidMinutes,
  fetchImpl,
} = {}) {
  const pack = minutePackView(env, { prepaidMinutes });
  if (pack.atPackCap) {
    const err = new Error(pack.gatedReason || 'Pack cap reached (60 min / 12 packs this period).');
    err.status = 409;
    throw err;
  }
  const id = String(customerId || '').trim();
  if (!id) {
    const err = new Error('No Stripe customer on this account');
    err.status = 404;
    throw err;
  }
  const priceId = String((env && env[MINUTE_PACK_PRICE_ENV]) || '').trim();
  const form = minutePackCheckoutForm({
    origin,
    customerId: id,
    email,
    phone,
    priceId,
  });
  const amount = form.get('line_items[0][price_data][unit_amount]');
  if (amount && amount !== String(PACK_AMOUNT_CENTS)) {
    const err = new Error('Minute pack amount must be $1.00');
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
    kind: MINUTE_PACK_KIND,
    minutes: PACK_MINUTES,
    amountCents: PACK_AMOUNT_CENTS,
    priceConfigured: true,
    customerId: id,
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
  const details = session.customer_details || {};
  const metadata = session.metadata || {};
  const name = String(metadata.name || details.name || '').trim();
  return {
    ok: true,
    plan: plan.id,
    minutes: plan.minutes,
    overage: plan.overage,
    retainAfterCall,
    phone,
    email: (session.metadata && session.metadata.email) || session.customer_email || null,
    name: name || null,
    firstName: firstNameFrom(name),
    customerId: typeof session.customer === 'string' ? session.customer : session.customer && session.customer.id,
    subscriptionId: typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription && session.subscription.id,
    sessionId: session.id,
  };
}

export async function verifyCheckoutSession(env, sessionId, fetchImpl) {
  const mode = requireStripeSecret(env.STRIPE_SECRET_KEY);
  const id = assertCheckoutSessionId(sessionId, mode);
  const session = await stripeRequest(env, {
    method: 'GET',
    path: `checkout/sessions/${encodeURIComponent(id)}`,
    fetchImpl,
  });
  const view = paidSessionView(session);
  if (!view.customerId) return view;
  try {
    const customer = await stripeRequest(env, {
      method: 'GET',
      path: `customers/${encodeURIComponent(view.customerId)}`,
      fetchImpl,
    });
    const name = String(customer.name || view.name || '').trim();
    view.name = name || null;
    view.firstName = firstNameFrom(name);
  } catch {
    // Keep Checkout Session name when Customer retrieve fails.
  }
  return view;
}

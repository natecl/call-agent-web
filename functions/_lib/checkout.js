import { getPlan, PERSONAL_TO_PLUS_DELTA_CENTS, PERSONAL_TO_PLUS_KIND, isPersonalToPlusCheckout } from './plans.js';
import { assertPhone, assertUserPhone } from './phone.js';
import { normalizeRetain } from './retain.js';
import { assertCheckoutSessionId, encodeForm, requireStripeSecret, stripeRequest } from './stripe.js';
import { findCustomerByEmail, findSubscriptionForCustomer } from './stripe_account.js';
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

function planFromCustomerAndSubscription(customer, subscription) {
  const meta = (customer && customer.metadata) || {};
  const subMeta = (subscription && subscription.metadata) || {};
  return getPlan(meta.plan || subMeta.plan);
}

function isActivePaidSubscription(subscription) {
  const status = String((subscription && subscription.status) || '').toLowerCase();
  if (!subscription || !subscription.id || !status) return false;
  if (status === 'incomplete_expired' || status === 'canceled' || status === 'incomplete') return false;
  return true;
}

function firstSubscriptionItemId(subscription) {
  const items = subscription && subscription.items && Array.isArray(subscription.items.data)
    ? subscription.items.data
    : [];
  return items[0] && items[0].id ? String(items[0].id) : '';
}

export function isPersonalToPlusUpgrade(plan, customer, subscription) {
  return Boolean(
    plan
    && plan.id === 'plus'
    && customer
    && customer.id
    && isActivePaidSubscription(subscription)
    && planFromCustomerAndSubscription(customer, subscription)
    && planFromCustomerAndSubscription(customer, subscription).id === 'personal',
  );
}

export function personalToPlusCheckoutForm({
  origin,
  email,
  name,
  phone,
  retainAfterCall,
  customerId,
  subscriptionId,
}) {
  const plus = getPlan('plus');
  const fields = {
    mode: 'payment',
    customer: customerId,
    client_reference_id: PERSONAL_TO_PLUS_KIND,
    success_url: `${origin}/dashboard.html?session_id={CHECKOUT_SESSION_ID}&plan=plus`,
    cancel_url: `${origin}/pay.html?plan=plus`,
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(PERSONAL_TO_PLUS_DELTA_CENTS),
    'line_items[0][price_data][product_data][name]': 'Treena Plus upgrade',
    'line_items[0][price_data][product_data][description]': 'Personal to Plus · $20 today · then $40/mo',
    'metadata[kind]': PERSONAL_TO_PLUS_KIND,
    'metadata[plan]': plus.id,
    'metadata[from_plan]': 'personal',
    'metadata[upgrade_delta_cents]': String(PERSONAL_TO_PLUS_DELTA_CENTS),
    'metadata[minutes]': String(plus.minutes),
    'metadata[email]': email,
    'metadata[name]': name || undefined,
    'metadata[phone]': phone,
    'metadata[retain_after_call]': retainAfterCall,
    'metadata[subscription]': subscriptionId,
  };
  return encodeForm(fields);
}

function plusRecurringFields(env, itemId) {
  const plus = getPlan('plus');
  const fields = {
    proration_behavior: 'none',
    'metadata[plan]': plus.id,
    'metadata[minutes]': String(plus.minutes),
    'metadata[overage]': plus.overage,
  };
  if (itemId) fields['items[0][id]'] = itemId;
  const priceId = String((env && env[plus.priceEnv]) || '').trim();
  if (priceId) {
    fields['items[0][price]'] = priceId;
  } else {
    fields['items[0][price_data][currency]'] = 'usd';
    fields['items[0][price_data][unit_amount]'] = String(plus.amountCents);
    fields['items[0][price_data][recurring][interval]'] = 'month';
    fields['items[0][price_data][product_data][name]'] = plus.productName;
    fields['items[0][price_data][product_data][description]'] = plus.productDescription;
  }
  return fields;
}

export async function switchSubscriptionToPlus(env, { customerId, subscriptionId, email, name, phone, retainAfterCall, fetchImpl } = {}) {
  const plus = getPlan('plus');
  const id = String(subscriptionId || '').trim();
  if (!id) {
    const err = new Error('No Personal subscription to upgrade');
    err.status = 404;
    throw err;
  }
  const subscription = await stripeRequest(env, {
    method: 'GET',
    path: `subscriptions/${encodeURIComponent(id)}`,
    fetchImpl,
  });
  const alreadyPlus = planFromCustomerAndSubscription(null, subscription)
    && planFromCustomerAndSubscription(null, subscription).id === 'plus';
  const itemId = firstSubscriptionItemId(subscription);
  if (!alreadyPlus) {
    if (!itemId) {
      const err = new Error('Personal subscription has no item to switch to Plus');
      err.status = 502;
      throw err;
    }
    const form = encodeForm(plusRecurringFields(env, itemId));
    const amount = form.get('items[0][price_data][unit_amount]');
    if (amount && amount !== String(plus.amountCents)) {
      const err = new Error('Plus recurring amount must be $40');
      err.status = 500;
      throw err;
    }
    if (form.get('proration_behavior') !== 'none') {
      const err = new Error('Upgrade must not invent Stripe proration');
      err.status = 500;
      throw err;
    }
    await stripeRequest(env, {
      method: 'POST',
      path: `subscriptions/${encodeURIComponent(id)}`,
      form,
      fetchImpl,
    });
  }
  const customer = await stripeRequest(env, {
    method: 'POST',
    path: `customers/${encodeURIComponent(customerId)}`,
    form: encodeForm(customerFields({
      email,
      name,
      phone,
      plan: plus,
      retainAfterCall,
    })),
    fetchImpl,
  });
  await postAccountSync(
    env,
    payloadFromStripeCustomer({
      ...customer,
      id: customerId,
      email,
      name: name || customer.name,
      phone,
      metadata: {
        ...(customer.metadata || {}),
        plan: plus.id,
        minutes: String(plus.minutes),
        phone,
        retain_after_call: retainAfterCall,
      },
    }, { eventCreated: Date.now() / 1000 }),
    fetchImpl,
  );
  return {
    plan: plus.id,
    minutes: plus.minutes,
    amountCents: plus.amountCents,
    subscriptionId: id,
    customerId,
  };
}

export async function applyPaidPersonalToPlusUpgrade(env, session, fetchImpl) {
  if (!isPersonalToPlusCheckout(session)) return null;
  const complete = session.status === 'complete';
  const paid = session.payment_status === 'paid';
  if (!complete || !paid) {
    const err = new Error('Payment is not complete');
    err.status = 402;
    throw err;
  }
  const plus = getPlan('plus');
  const metadata = session.metadata || {};
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer && session.customer.id;
  const phone = assertUserPhone(metadata.phone || (session.customer_details && session.customer_details.phone), env);
  const email = assertEmail(metadata.email || session.customer_email);
  const retain = normalizeRetain(metadata.retain_after_call);
  const name = String(metadata.name || (session.customer_details && session.customer_details.name) || '').trim();
  let subscriptionId = String(metadata.subscription || '').trim();
  if (!subscriptionId && customerId) {
    const existing = await findSubscriptionForCustomer(env, customerId, fetchImpl);
    subscriptionId = existing && existing.id ? existing.id : '';
  }
  const switched = await switchSubscriptionToPlus(env, {
    customerId,
    subscriptionId,
    email,
    name,
    phone,
    retainAfterCall: retain,
    fetchImpl,
  });
  return {
    ok: true,
    kind: PERSONAL_TO_PLUS_KIND,
    plan: plus.id,
    minutes: plus.minutes,
    overage: plus.overage,
    retainAfterCall: retain,
    phone,
    email,
    name: name || null,
    firstName: firstNameFrom(name),
    customerId,
    subscriptionId: switched.subscriptionId,
    sessionId: session.id,
    upgradeDeltaCents: PERSONAL_TO_PLUS_DELTA_CENTS,
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
  const existingCustomer = await findCustomerByEmail(env, normalizedEmail, fetchImpl);
  const existingSubscription = existingCustomer && existingCustomer.id
    ? await findSubscriptionForCustomer(env, existingCustomer.id, fetchImpl)
    : null;

  if (isPersonalToPlusUpgrade(plan, existingCustomer, existingSubscription)) {
    const plus = getPlan('plus');
    const customer = await findOrCreateCustomer(env, {
      email: normalizedEmail,
      name: trimmedName,
      phone: normalizedPhone,
      plan: getPlan('personal'),
      retainAfterCall: retain,
      fetchImpl,
    });
    const form = personalToPlusCheckoutForm({
      origin,
      email: normalizedEmail,
      name: trimmedName,
      phone: normalizedPhone,
      retainAfterCall: retain,
      customerId: customer.id,
      subscriptionId: existingSubscription.id,
    });
    const amount = form.get('line_items[0][price_data][unit_amount]');
    if (amount !== String(PERSONAL_TO_PLUS_DELTA_CENTS)) {
      const err = new Error('Personal to Plus upgrade must charge $20 today');
      err.status = 500;
      throw err;
    }
    if (form.get('mode') !== 'payment' || form.has('line_items[0][price]') || form.has('subscription_data[trial_period_days]')) {
      const err = new Error('Personal to Plus upgrade must be a $20 payment, not a new Plus subscription');
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
      plan: plus.id,
      minutes: plus.minutes,
      phone: normalizedPhone,
      retainAfterCall: retain,
      customerId: customer.id,
      kind: PERSONAL_TO_PLUS_KIND,
      dueTodayCents: PERSONAL_TO_PLUS_DELTA_CENTS,
      recurringAmountCents: plus.amountCents,
    };
  }

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
  if (!isPersonalToPlusCheckout(session) && session.mode && session.mode !== 'subscription') {
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
  if (isPersonalToPlusCheckout(session)) {
    await applyPaidPersonalToPlusUpgrade(env, session, fetchImpl);
  }
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
    const livePlan = getPlan(customer.metadata && customer.metadata.plan);
    if (livePlan && livePlan.id === 'plus') {
      view.plan = livePlan.id;
      view.minutes = livePlan.minutes;
      view.overage = livePlan.overage;
    }
  } catch {
    // Keep Checkout Session name when Customer retrieve fails.
  }
  return view;
}

import { getPlan } from './plans.js';
import { assertPhone } from './phone.js';
import { normalizeRetain } from './retain.js';
import { firstNameFrom } from './sync.js';
import { stripeRequest } from './stripe.js';

export async function findCustomerByEmail(env, email, fetchImpl) {
  const value = String(email || '').trim().toLowerCase();
  if (!value) return null;
  const listed = await stripeRequest(env, {
    method: 'GET',
    path: `customers?email=${encodeURIComponent(value)}&limit=1`,
    fetchImpl,
  });
  return (listed && listed.data && listed.data[0]) || null;
}

function subscriptionRank(status) {
  const rank = {
    active: 0,
    past_due: 1,
    unpaid: 2,
    trialing: 3,
    paused: 4,
    incomplete: 5,
    canceled: 6,
    incomplete_expired: 7,
  };
  const key = String(status || '').toLowerCase();
  return rank[key] != null ? rank[key] : 50;
}

export async function findSubscriptionForCustomer(env, customerId, fetchImpl) {
  const id = String(customerId || '').trim();
  if (!id) return null;
  const listed = await stripeRequest(env, {
    method: 'GET',
    path: `subscriptions?customer=${encodeURIComponent(id)}&status=all&limit=10`,
    fetchImpl,
  });
  const subs = Array.isArray(listed && listed.data) ? listed.data.slice() : [];
  if (!subs.length) return null;
  subs.sort((a, b) => subscriptionRank(a && a.status) - subscriptionRank(b && b.status));
  return subs[0];
}

export function paidAccountFromCustomer(customer, subscription) {
  if (!customer || !customer.id) return null;
  const metadata = customer.metadata || {};
  const subMeta = (subscription && subscription.metadata) || {};
  const plan = getPlan(metadata.plan || subMeta.plan);
  let phone = null;
  try {
    phone = assertPhone(customer.phone || metadata.phone);
  } catch {
    phone = null;
  }
  const name = String(customer.name || '').trim();
  const email = String(customer.email || '').trim().toLowerCase() || null;
  const hasSubscription = Boolean(subscription && subscription.id && subscription.status !== 'incomplete_expired');
  return {
    ok: true,
    hasAccount: hasSubscription,
    plan: plan ? plan.id : (metadata.plan || null),
    minutes: plan ? plan.minutes : (metadata.minutes ? Number(metadata.minutes) : null),
    overage: plan ? plan.overage : (subMeta.overage || null),
    retainAfterCall: normalizeRetain(metadata.retain_after_call),
    phone,
    email,
    name: name || null,
    firstName: firstNameFrom(name),
    customerId: customer.id,
    subscriptionId: subscription && subscription.id ? subscription.id : null,
    sessionId: null,
    subscription,
    customer,
  };
}

export async function lookupPaidAccount(env, email, fetchImpl) {
  if (!env || !env.STRIPE_SECRET_KEY) return null;
  try {
    const customer = await findCustomerByEmail(env, email, fetchImpl);
    if (!customer) return null;
    const subscription = await findSubscriptionForCustomer(env, customer.id, fetchImpl);
    return paidAccountFromCustomer(customer, subscription);
  } catch {
    return null;
  }
}

export function dashboardPathIfAccount(next, hasAccount) {
  const path = String(next || '');
  if (!hasAccount) return path;
  if (!path || path === '/' || path.startsWith('/index') || path.startsWith('/login') || path.startsWith('/account')) {
    return '/dashboard';
  }
  return path;
}

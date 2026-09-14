import { getPlan } from './plans.js';
import { assertPhone } from './phone.js';
import { normalizeRetain } from './retain.js';
import { firstNameFrom } from './sync.js';
import { encodeForm, stripeRequest } from './stripe.js';
import { isComplimentaryEmail } from './entitlement.js';

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
    complimentary: false,
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

function defaultProvePlan() {
  return getPlan('personal');
}

export function markComplimentary(account, env, email) {
  if (!isComplimentaryEmail(env, email)) return account;
  const plan = getPlan((account && account.plan) || 'personal') || defaultProvePlan();
  const base = account || {};
  const name = base.name || null;
  return {
    ok: true,
    hasAccount: true,
    complimentary: true,
    plan: (getPlan(base.plan) && base.plan) || plan.id,
    minutes: base.minutes || plan.minutes,
    overage: base.overage || plan.overage,
    retainAfterCall: base.retainAfterCall || 'off',
    phone: base.phone || null,
    email: String(email || '').trim().toLowerCase(),
    name,
    firstName: base.firstName || firstNameFrom(name),
    customerId: base.customerId || null,
    subscriptionId: base.subscriptionId || null,
    sessionId: base.sessionId || null,
    subscription: base.subscription || null,
    customer: base.customer || null,
  };
}

export async function lookupPaidAccount(env, email, fetchImpl) {
  const complimentary = isComplimentaryEmail(env, email);
  if (!env || !env.STRIPE_SECRET_KEY) {
    return complimentary ? markComplimentary(null, env, email) : null;
  }
  try {
    const customer = await findCustomerByEmail(env, email, fetchImpl);
    if (!customer) {
      return complimentary ? markComplimentary(null, env, email) : null;
    }
    const subscription = await findSubscriptionForCustomer(env, customer.id, fetchImpl);
    const account = paidAccountFromCustomer(customer, subscription);
    return complimentary ? markComplimentary(account, env, email) : account;
  } catch {
    return complimentary ? markComplimentary(null, env, email) : null;
  }
}

function complimentaryCustomerFields({ email, name, phone }) {
  const plan = defaultProvePlan();
  return {
    email,
    name: name || undefined,
    phone: phone || undefined,
    'metadata[plan]': plan.id,
    'metadata[minutes]': String(plan.minutes),
    'metadata[phone]': phone || undefined,
    'metadata[retain_after_call]': 'off',
    'metadata[complimentary]': 'on',
    'metadata[source]': 'usetreena-pages',
  };
}

/** Create a Stripe Customer (no subscription, no invoice) so portal can open. Env allowlist is the grant. */
export async function ensureComplimentaryCustomer(env, { email, name, phone, fetchImpl } = {}) {
  const value = String(email || '').trim().toLowerCase();
  if (!isComplimentaryEmail(env, value)) {
    return lookupPaidAccount(env, value, fetchImpl);
  }
  if (!env || !env.STRIPE_SECRET_KEY) {
    return markComplimentary(null, env, value);
  }
  try {
    let customer = await findCustomerByEmail(env, value, fetchImpl);
    if (!customer) {
      customer = await stripeRequest(env, {
        method: 'POST',
        path: 'customers',
        form: encodeForm(complimentaryCustomerFields({
          email: value,
          name,
          phone,
        })),
        fetchImpl,
      });
    } else if (name && !customer.name) {
      customer = await stripeRequest(env, {
        method: 'POST',
        path: `customers/${encodeURIComponent(customer.id)}`,
        form: encodeForm({ name }),
        fetchImpl,
      });
    }
    const subscription = customer && customer.id
      ? await findSubscriptionForCustomer(env, customer.id, fetchImpl)
      : null;
    return markComplimentary(paidAccountFromCustomer(customer, subscription), env, value);
  } catch {
    return markComplimentary(null, env, value);
  }
}

export async function resolveAccount(env, { email, name, phone } = {}, fetchImpl) {
  const value = String(email || '').trim().toLowerCase();
  if (!value) return null;
  if (isComplimentaryEmail(env, value)) {
    return ensureComplimentaryCustomer(env, { email: value, name, phone, fetchImpl });
  }
  return lookupPaidAccount(env, value, fetchImpl);
}

export function planIdFromPath(path) {
  try {
    const url = new URL(String(path || ''), 'https://usetreena.com');
    const plan = url.searchParams.get('plan');
    if (plan === 'personal' || plan === 'plus') return plan;
  } catch {
    /* ignore */
  }
  return 'personal';
}

function pathnameOf(path) {
  return String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
}

export function signupDetailsPath(path) {
  const pathname = pathnameOf(path);
  return pathname === '/account' || pathname === '/account.html';
}

export function loginLikePath(path) {
  const pathname = pathnameOf(path);
  return pathname === '/login' || pathname === '/login.html' || pathname === '/signin'
    || pathname === '/sign-in' || pathname === '/log-in';
}

export function payPathForPlan(planId) {
  const plan = planId === 'plus' ? 'plus' : 'personal';
  return `/pay.html?plan=${plan}`;
}

export function dashboardPathIfAccount(next, hasAccount) {
  const path = String(next || '');
  if (!hasAccount) return path;
  if (!path || path === '/' || path.startsWith('/index') || path.startsWith('/login') || path.startsWith('/account')) {
    return '/dashboard';
  }
  return path;
}

/** After Google/Apple identity is established, skip Your details and continue to Review & pay. */
export function continuePathAfterIdentity(next, hasAccount) {
  const path = String(next || '/account.html?plan=personal');
  if (hasAccount) return dashboardPathIfAccount(path, true);
  if (signupDetailsPath(path) || loginLikePath(path)) {
    return payPathForPlan(planIdFromPath(path));
  }
  return path;
}

import { encodeForm, stripeRequest } from './stripe.js';
import { getPlan } from './plans.js';

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Convert a Stripe unix timestamp to ISO-8601. Returns null when Stripe omitted it. Never invents a date. */
export function unixToIso(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function itemPeriod(subscription) {
  const items = subscription && subscription.items && Array.isArray(subscription.items.data)
    ? subscription.items.data
    : [];
  return items[0] || null;
}

/**
 * Billing-period fields from a Stripe Subscription only.
 * Stripe API 2024+ may store current_period_* on the item, not the subscription.
 */
export function periodFromSubscription(subscription) {
  if (!subscription) {
    return {
      periodStart: null,
      periodEnd: null,
      renewsAt: null,
      minutesResetAt: null,
      cancelAtPeriodEnd: false,
      cancelEffectiveAt: null,
      canceledAt: null,
    };
  }
  const item = itemPeriod(subscription);
  const start = subscription.current_period_start ?? (item && item.current_period_start);
  const end = subscription.current_period_end ?? (item && item.current_period_end);
  const periodStart = unixToIso(start);
  const periodEnd = unixToIso(end);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const cancelEffectiveAt = unixToIso(subscription.cancel_at)
    || (cancelAtPeriodEnd ? periodEnd : null);
  return {
    periodStart,
    periodEnd,
    renewsAt: cancelAtPeriodEnd ? null : periodEnd,
    minutesResetAt: periodEnd,
    cancelAtPeriodEnd,
    cancelEffectiveAt,
    canceledAt: unixToIso(subscription.canceled_at),
  };
}

export async function retrieveSubscription(env, subscriptionId, fetchImpl) {
  const id = String(subscriptionId || '').trim();
  if (!id) return null;
  return stripeRequest(env, {
    method: 'GET',
    path: `subscriptions/${encodeURIComponent(id)}`,
    fetchImpl,
  });
}

export async function createBillingPortalSession(env, { customerId, origin, fetchImpl }) {
  const id = String(customerId || '').trim();
  if (!id) throw fail('No Stripe customer on this account', 404);
  const returnUrl = `${String(origin || '').replace(/\/+$/, '')}/dashboard`;
  const session = await stripeRequest(env, {
    method: 'POST',
    path: 'billing_portal/sessions',
    form: encodeForm({
      customer: id,
      return_url: returnUrl,
    }),
    fetchImpl,
  });
  if (!session || !session.url) throw fail('Stripe Customer Portal URL missing', 502);
  return { ok: true, url: session.url };
}

export async function cancelSubscriptionAtPeriodEnd(env, { subscriptionId, fetchImpl }) {
  const id = String(subscriptionId || '').trim();
  if (!id) throw fail('No Stripe subscription on this account', 404);
  const existing = await retrieveSubscription(env, id, fetchImpl);
  if (!existing || !existing.id) throw fail('No Stripe subscription on this account', 404);
  if (existing.status === 'canceled') {
    return {
      ok: true,
      alreadyCanceled: true,
      status: existing.status,
      subscriptionId: existing.id,
      ...periodFromSubscription(existing),
    };
  }
  if (existing.cancel_at_period_end) {
    return {
      ok: true,
      alreadyCanceled: false,
      status: existing.status,
      subscriptionId: existing.id,
      ...periodFromSubscription(existing),
    };
  }
  const subscription = await stripeRequest(env, {
    method: 'POST',
    path: `subscriptions/${encodeURIComponent(id)}`,
    form: encodeForm({ cancel_at_period_end: 'true' }),
    fetchImpl,
  });
  return {
    ok: true,
    alreadyCanceled: false,
    status: subscription.status || existing.status,
    subscriptionId: subscription.id || id,
    ...periodFromSubscription(subscription),
  };
}

export function planFromView(sessionView) {
  return getPlan(sessionView && sessionView.plan);
}

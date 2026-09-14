import { getPlan } from './plans.js';
import { stripeModeFromEnv, stripeRequest } from './stripe.js';
import { firstNameFrom, getAccountDashboard } from './sync.js';
import { verifyCheckoutSession } from './checkout.js';

export function usageFromFly(user, threads, planMinutes) {
  const includedRaw = user && user.minutes_included;
  const minutesIncluded = Number.isFinite(Number(includedRaw))
    ? Number(includedRaw)
    : Number(planMinutes) || 0;
  const usedRaw = user && user.minutes_used;
  const minutesUsed = Number.isFinite(Number(usedRaw)) ? Number(usedRaw) : 0;
  const list = Array.isArray(threads) ? threads : [];
  const callCount = list.filter((thread) => thread && thread.call).length;
  return {
    minutesIncluded,
    minutesUsed,
    callCount,
    usageNote: minutesUsed === 0 ? 'Usage totals update after calls.' : null,
  };
}

export async function billingView(env, sessionView, fetchImpl) {
  const plan = getPlan(sessionView.plan);
  if (!plan) {
    const err = new Error('Unknown plan on Checkout Session');
    err.status = 400;
    throw err;
  }
  let status = 'active';
  if (sessionView.subscriptionId) {
    try {
      const subscription = await stripeRequest(env, {
        method: 'GET',
        path: `subscriptions/${encodeURIComponent(sessionView.subscriptionId)}`,
        fetchImpl,
      });
      if (subscription && subscription.status) status = subscription.status;
    } catch {
      status = 'active';
    }
  }
  const mode = stripeModeFromEnv(env) || 'test';
  const live = mode === 'live';
  return {
    mode,
    test: !live,
    live,
    badge: live ? null : 'TEST',
    noRealCharge: !live,
    plan: plan.id,
    planName: plan.name,
    amountCents: plan.amountCents,
    minutes: plan.minutes,
    overage: plan.overage,
    subscriptionId: sessionView.subscriptionId || null,
    status,
    customerId: sessionView.customerId || null,
  };
}

export async function loadDashboard(env, sessionId, fetchImpl) {
  const session = await verifyCheckoutSession(env, sessionId, fetchImpl);
  const fly = await getAccountDashboard(env, session.phone, fetchImpl);
  const flyName = fly.user && (fly.user.first_name || (fly.user.name && fly.user.name.first_name));
  const name = String((session.name || (fly.user && fly.user.prefs && fly.user.prefs.full_name) || '')).trim();
  const firstName = session.firstName || firstNameFrom(name) || firstNameFrom(flyName) || null;
  const needsName = !firstName;
  const billing = await billingView(env, session, fetchImpl);
  const threads = fly.threads || [];
  const calls = fly.calls || [];
  return {
    ok: true,
    needsName,
    name: name || null,
    firstName,
    phone: session.phone,
    email: session.email,
    sessionId: session.sessionId,
    fly: {
      skipped: Boolean(fly.skipped),
      reason: fly.reason || null,
    },
    usage: usageFromFly(fly.user, threads, session.minutes),
    billing,
    threads,
    calls,
    user: fly.user || null,
  };
}

import { getPlan } from './plans.js';
import { stripeModeFromEnv, stripeRequest } from './stripe.js';
import { firstNameFrom, getAccountDashboard } from './sync.js';
import { verifyCheckoutSession } from './checkout.js';
import { periodFromSubscription, unixToIso } from './billing.js';
import { normalizeRetain } from './retain.js';

export function usageFromFly(user, threads, planMinutes, billingPeriod) {
  const includedRaw = user && user.minutes_included;
  const minutesIncluded = Number.isFinite(Number(includedRaw))
    ? Number(includedRaw)
    : Number(planMinutes) || 0;
  const usedRaw = user && user.minutes_used;
  const minutesUsed = Number.isFinite(Number(usedRaw)) ? Number(usedRaw) : 0;
  const list = Array.isArray(threads) ? threads : [];
  const callCount = list.filter((thread) => thread && thread.call).length;
  const flyReset = user && (user.minutes_reset_at || user.minutesResetAt || user.billing_period_end);
  const minutesResetAt = unixToIso(flyReset) || (billingPeriod && billingPeriod.minutesResetAt) || null;
  return {
    minutesIncluded,
    minutesUsed,
    callCount,
    minutesResetAt,
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
  let subscription = null;
  if (sessionView.subscription) {
    subscription = sessionView.subscription;
  } else if (sessionView.subscriptionId) {
    try {
      subscription = await stripeRequest(env, {
        method: 'GET',
        path: `subscriptions/${encodeURIComponent(sessionView.subscriptionId)}`,
        fetchImpl,
      });
    } catch {
      subscription = null;
    }
  }
  if (subscription && subscription.status) status = subscription.status;
  const paidSub = Boolean(
    subscription
    && subscription.id
    && subscription.status
    && subscription.status !== 'incomplete_expired'
    && subscription.status !== 'canceled',
  );
  const complimentary = Boolean(sessionView.complimentary) && !paidSub;
  if (complimentary) status = 'complimentary';
  const period = complimentary && !paidSub
    ? periodFromSubscription(null)
    : periodFromSubscription(subscription);
  const mode = stripeModeFromEnv(env) || 'test';
  const live = mode === 'live';
  return {
    mode,
    test: !live,
    live,
    badge: live ? null : 'TEST',
    noRealCharge: !live || complimentary,
    complimentary,
    canManageBilling: !complimentary,
    plan: plan.id,
    planName: plan.name,
    amountCents: plan.amountCents,
    minutes: plan.minutes,
    overage: plan.overage,
    subscriptionId: sessionView.subscriptionId || (subscription && subscription.id) || null,
    status,
    customerId: sessionView.customerId || null,
    ...period,
  };
}

function settingsFrom(session, flyUser) {
  const retainFly = flyUser && typeof flyUser.retain_call_artifacts === 'boolean'
    ? (flyUser.retain_call_artifacts ? 'on' : 'off')
    : null;
  const retain = retainFly || session.retainAfterCall || 'off';
  return {
    name: session.name || (flyUser && flyUser.prefs && flyUser.prefs.full_name) || null,
    email: session.email || null,
    phone: session.phone || (flyUser && flyUser.phone) || null,
    retainAfterCall: normalizeRetain(retain),
  };
}

export async function loadDashboard(env, sessionIdOrOpts, fetchImpl) {
  const opts = typeof sessionIdOrOpts === 'string'
    ? { sessionId: sessionIdOrOpts }
    : (sessionIdOrOpts || {});
  let session;
  if (opts.view) {
    session = opts.view;
  } else if (opts.sessionId) {
    session = await verifyCheckoutSession(env, opts.sessionId, fetchImpl);
  } else {
    const err = new Error('Sign in to continue');
    err.status = 401;
    throw err;
  }
  const fly = session.phone
    ? await getAccountDashboard(env, session.phone, fetchImpl)
    : { skipped: true, reason: 'missing phone', ok: true, user: null, threads: [], calls: [] };
  const flyName = fly.user && (fly.user.first_name || (fly.user.name && fly.user.name.first_name));
  const name = String((session.name || (fly.user && fly.user.prefs && fly.user.prefs.full_name) || '')).trim();
  const firstName = session.firstName || firstNameFrom(name) || firstNameFrom(flyName) || null;
  const needsName = !firstName;
  const billing = await billingView(env, {
    ...session,
    complimentary: Boolean(session.complimentary),
  }, fetchImpl);
  const threads = fly.threads || [];
  const calls = fly.calls || [];
  const settings = settingsFrom(session, fly.user);
  return {
    ok: true,
    needsName,
    name: name || null,
    firstName,
    phone: session.phone,
    email: session.email,
    sessionId: session.sessionId || null,
    csrf: opts.csrf || null,
    fly: {
      skipped: Boolean(fly.skipped),
      reason: fly.reason || null,
    },
    usage: usageFromFly(fly.user, threads, session.minutes, billing),
    billing,
    settings,
    threads,
    calls,
    user: fly.user || null,
  };
}

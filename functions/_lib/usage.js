import { unixToIso } from './billing.js';
import { stripeModeFromEnv } from './stripe.js';

/** Cap lock 2026-09-14: $1.00 per 5 connected minutes. Max 60 extra min (12 packs). No auto-meter. */
export const PACK_MINUTES = 5;
export const PACK_AMOUNT_CENTS = 100;
export const PACK_MAX_COUNT = 12;
export const PACK_MAX_MINUTES = PACK_MINUTES * PACK_MAX_COUNT;
export const MINUTE_PACK_KIND = 'minute_pack';
export const MINUTE_PACK_PRICE_ENV = 'STRIPE_PRICE_MINUTE_PACK';
export const PACK_PRODUCT_NAME = 'Treena 5-minute pack';
export const PACK_PRODUCT_DESCRIPTION = '5 connected minutes · $1.00';

/** TEST prove fixtures. Fly ledger values win when present. */
export const USAGE_SEEDS = {
  ok: { minutesIncluded: 30, minutesUsed: 12, prepaidMinutes: 0 },
  approaching: { minutesIncluded: 30, minutesUsed: 26, prepaidMinutes: 0 },
  at_cap: { minutesIncluded: 30, minutesUsed: 30, prepaidMinutes: 0 },
  after_pack: { minutesIncluded: 30, minutesUsed: 30, prepaidMinutes: 5 },
  pack_cap: { minutesIncluded: 30, minutesUsed: 90, prepaidMinutes: 60 },
};

export function parseUsageSeed(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  if (!raw) return null;
  if (raw === 'atcap') return 'at_cap';
  if (raw === 'afterpack' || raw === 'after_pack_purchase') return 'after_pack';
  if (raw === 'packcap' || raw === 'max_packs') return 'pack_cap';
  return USAGE_SEEDS[raw] ? raw : null;
}

export function usageSeedNameFromEnv(env) {
  if (stripeModeFromEnv(env) !== 'test') return null;
  return parseUsageSeed(env && env.DASHBOARD_USAGE_SEED);
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function prepaidMinutesFromUser(user) {
  if (!user) return null;
  return finiteNumber(
    user.prepaid_minutes
    ?? user.minutes_prepaid
    ?? user.pack_minutes
    ?? user.minutes_pack,
  );
}

export function isMinutePackCheckout(obj) {
  if (!obj) return false;
  const kind = (obj.metadata && obj.metadata.kind) || obj.client_reference_id;
  return kind === MINUTE_PACK_KIND;
}

export function packsFromPrepaid(prepaidMinutes) {
  const prepaid = Math.max(0, Number(prepaidMinutes) || 0);
  const packsUsed = Math.min(PACK_MAX_COUNT, Math.floor(prepaid / PACK_MINUTES));
  return {
    prepaidMinutes: prepaid,
    packsUsed,
    packsRemaining: Math.max(0, PACK_MAX_COUNT - packsUsed),
    atPackCap: prepaid >= PACK_MAX_MINUTES || packsUsed >= PACK_MAX_COUNT,
  };
}

export function minutePackView(env = {}, { complimentary = false, prepaidMinutes = 0 } = {}) {
  const priceId = String((env && env[MINUTE_PACK_PRICE_ENV]) || '').trim();
  const slots = packsFromPrepaid(prepaidMinutes);
  let gatedReason = null;
  if (complimentary) gatedReason = 'Complimentary access. Packs are for paid plans.';
  else if (slots.atPackCap) gatedReason = 'Pack cap reached (60 min / 12 packs this period).';
  return {
    minutes: PACK_MINUTES,
    kind: MINUTE_PACK_KIND,
    priceId: priceId || null,
    priceConfigured: true,
    amountCents: PACK_AMOUNT_CENTS,
    amountLabel: '$1.00',
    maxPacks: PACK_MAX_COUNT,
    maxPrepaidMinutes: PACK_MAX_MINUTES,
    packsUsed: slots.packsUsed,
    packsRemaining: slots.packsRemaining,
    atPackCap: slots.atPackCap,
    autoMeter: false,
    canPurchase: !complimentary && !slots.atPackCap,
    gatedReason,
  };
}

export function capState(remaining) {
  const left = Math.max(0, Number(remaining) || 0);
  if (left <= 0) return 'at_cap';
  if (left <= PACK_MINUTES) return 'approaching';
  return 'ok';
}

export function usageNoteFor(state, { minutesUsed, prepaidMinutes } = {}) {
  if (state === 'at_cap') return 'At your minute cap. Add a 5-minute pack ($1.00) to place another call.';
  if (state === 'approaching') return 'Approaching your minute cap. Add a 5-minute pack ($1.00) to keep calling.';
  if (Number(prepaidMinutes) > 0) return 'Remaining minutes include prepaid pack minutes.';
  if (Number(minutesUsed) === 0) return 'Usage totals update after calls.';
  return 'Usage totals update after calls.';
}

export function usageFromAccount({
  user,
  threads,
  planMinutes,
  billingPeriod,
  seedName,
  env,
  complimentary,
} = {}) {
  const seed = seedName && USAGE_SEEDS[seedName] ? USAGE_SEEDS[seedName] : null;
  const includedFly = finiteNumber(user && user.minutes_included);
  const usedFly = finiteNumber(user && user.minutes_used);
  const prepaidFly = prepaidMinutesFromUser(user);
  const remainingFly = finiteNumber(user && (user.minutes_remaining ?? user.remaining_minutes));

  const minutesIncluded = includedFly != null
    ? includedFly
    : (seed ? seed.minutesIncluded : (Number(planMinutes) || 0));
  const minutesUsed = usedFly != null ? usedFly : (seed ? seed.minutesUsed : 0);
  const prepaidMinutes = prepaidFly != null ? prepaidFly : (seed ? seed.prepaidMinutes : 0);
  const minutesAllowance = minutesIncluded + prepaidMinutes;
  const minutesRemaining = remainingFly != null
    ? Math.max(0, remainingFly)
    : Math.max(0, minutesAllowance - minutesUsed);
  const state = capState(minutesRemaining);
  const list = Array.isArray(threads) ? threads : [];
  const callCount = list.filter((thread) => thread && thread.call).length;
  const flyReset = user && (user.minutes_reset_at || user.minutesResetAt || user.billing_period_end);
  const minutesResetAt = unixToIso(flyReset) || (billingPeriod && billingPeriod.minutesResetAt) || null;
  const seedApplied = Boolean(seed) && usedFly == null && prepaidFly == null && remainingFly == null;
  const pack = minutePackView(env, { complimentary: Boolean(complimentary), prepaidMinutes });

  return {
    minutesIncluded,
    minutesUsed,
    prepaidMinutes,
    minutesAllowance,
    minutesRemaining,
    packMinutes: PACK_MINUTES,
    atCap: state === 'at_cap',
    approaching: state === 'approaching',
    state,
    autoMeter: false,
    callCount,
    minutesResetAt,
    usageNote: usageNoteFor(state, { minutesUsed, prepaidMinutes }),
    seed: seedApplied ? seedName : null,
    pack,
  };
}

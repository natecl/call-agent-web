export const COMPLIMENTARY_ENV = 'COMPLIMENTARY_ENTITLEMENT_EMAILS';

function textOf(env, key) {
  return String((env && env[key]) || '').trim();
}

/** Comma/whitespace-separated emails. Empty means no complimentary grants. Reversible: unset the env. */
export function complimentaryEmails(env = {}) {
  const raw = textOf(env, COMPLIMENTARY_ENV);
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isComplimentaryEmail(env, email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value) return false;
  return complimentaryEmails(env).includes(value);
}

/**
 * Complimentary prove grant with no paid Stripe subscription.
 * These accounts have no Checkout Session — do not open Customer Portal.
 * A later paid subscription on the same allowlisted email keeps the portal.
 */
export function isComplimentaryGrant(view) {
  if (!view || !view.complimentary) return false;
  if (view.subscriptionId) return false;
  const sub = view.subscription;
  if (sub && sub.id) {
    const status = String(sub.status || '');
    if (status && status !== 'incomplete_expired' && status !== 'canceled') return false;
  }
  return true;
}

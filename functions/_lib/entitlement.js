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

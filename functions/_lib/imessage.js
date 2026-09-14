import { normalizeE164 } from './phone.js';

/** Linq sandbox LINQ_FROM_E164 / L1 prove DID. Ride until ~Sep 18. Ops may swap via env. */
export const DEFAULT_TREENA_IMESSAGE_E164 = '+12138653024';
export const PUBLIC_TREENA_IMESSAGE_ENV = 'PUBLIC_TREENA_IMESSAGE_E164';
export const LINQ_FROM_E164_ENV = 'LINQ_FROM_E164';

export function smsUrlFor(e164) {
  return `sms:${e164}`;
}

export function treenaIMessageE164(env = {}) {
  const candidates = [
    env && env[PUBLIC_TREENA_IMESSAGE_ENV],
    env && env[LINQ_FROM_E164_ENV],
  ];
  for (const raw of candidates) {
    const value = String(raw || '').trim();
    if (!value) continue;
    try {
      return normalizeE164(value);
    } catch {
      // Ignore invalid override; fall through to the Cap-confirmed sandbox DID.
    }
  }
  return DEFAULT_TREENA_IMESSAGE_E164;
}

export function treenaIMessageView(env = {}) {
  const e164 = treenaIMessageE164(env);
  return {
    e164,
    smsUrl: smsUrlFor(e164),
    shared: true,
    envKeys: [PUBLIC_TREENA_IMESSAGE_ENV, LINQ_FROM_E164_ENV],
    note: 'Shared Treena iMessage bot number for everyone (not a per-user DID). Linq sandbox; ride until ~Sep 18. Ops may swap PUBLIC_TREENA_IMESSAGE_E164.',
  };
}

const E164_RE = /^\+[1-9]\d{7,14}$/;

/** Shared Telnyx FROM (Cap lock). Env may override; still reject the locked DID. */
export const DEFAULT_TELNYX_FROM_E164 = '+12135690899';
const DEFAULT_TREENA_IMESSAGE_E164 = '+12138653024';

function fail(message) {
  const err = new Error(message);
  err.status = 400;
  throw err;
}

export function normalizeE164(input) {
  const raw = String(input || '').trim();
  if (!raw) fail('A phone number is required');

  let compact = raw.replace(/[^\d+]/g, '');
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;

  if (!compact.startsWith('+')) {
    const digits = compact.replace(/\D/g, '');
    if (digits.length === 10) compact = `+1${digits}`;
    else if (digits.length === 11 && digits.startsWith('1')) compact = `+${digits}`;
    else fail('Use an E.164 phone number, like +14155552671');
  } else {
    compact = `+${compact.slice(1).replace(/\D/g, '')}`;
  }

  if (!E164_RE.test(compact)) fail('Use an E.164 phone number, like +14155552671');
  return compact;
}

export function assertPhone(input) {
  return normalizeE164(input);
}

export function reservedAccountPhones(env = {}) {
  const out = new Set();
  const add = (value) => {
    try {
      if (value) out.add(normalizeE164(value));
    } catch {
      // Ignore invalid env; still reject the Cap-locked defaults below.
    }
  };
  add(DEFAULT_TREENA_IMESSAGE_E164);
  add(DEFAULT_TELNYX_FROM_E164);
  add(env && env.TELNYX_FROM_NUMBER);
  add(env && env.TELNYX_PHONE_NUMBER);
  add(env && env.PUBLIC_TREENA_IMESSAGE_E164);
  add(env && env.LINQ_FROM_E164);
  return out;
}

export function assertUserPhone(phone, env = {}) {
  const e164 = assertPhone(phone);
  if (reservedAccountPhones(env).has(e164)) {
    fail('Use your own phone number — the one you’ll text Treena from. Not Treena’s shared number.');
  }
  return e164;
}

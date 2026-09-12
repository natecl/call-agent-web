const E164_RE = /^\+[1-9]\d{7,14}$/;

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

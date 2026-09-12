const STRIPE_API = 'https://api.stripe.com/v1';

export function requireTestSecret(secret) {
  if (!secret) {
    const err = new Error('Stripe TEST is not configured');
    err.status = 503;
    throw err;
  }
  if (secret.startsWith('sk_live_')) {
    const err = new Error('Live Stripe keys are not allowed');
    err.status = 500;
    throw err;
  }
  if (!secret.startsWith('sk_test_')) {
    const err = new Error('Stripe TEST secret required (sk_test_)');
    err.status = 500;
    throw err;
  }
}

export function requireTestPublishable(key) {
  if (!key) return null;
  if (key.startsWith('pk_live_')) {
    const err = new Error('Live Stripe keys are not allowed');
    err.status = 500;
    throw err;
  }
  if (!key.startsWith('pk_test_')) {
    const err = new Error('Stripe TEST publishable key required (pk_test_)');
    err.status = 500;
    throw err;
  }
  return key;
}

export async function stripeRequest(env, { method, path, form, fetchImpl }) {
  requireTestSecret(env.STRIPE_SECRET_KEY);
  const fetchFn = fetchImpl || fetch;
  const url = path.startsWith('http') ? path : `${STRIPE_API}/${path.replace(/^\//, '')}`;
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  const init = { method, headers };
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = form instanceof URLSearchParams ? form.toString() : new URLSearchParams(form).toString();
  }
  const res = await fetchFn(url, init);
  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error.message || 'Stripe error');
    err.status = 502;
    err.stripe = data.error;
    throw err;
  }
  return data;
}

export function encodeForm(fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    body.set(key, String(value));
  }
  return body;
}

function hexFromBuffer(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyStripeWebhook(secret, payload, header, nowMs = Date.now()) {
  if (!secret) {
    const err = new Error('Stripe webhook secret is not configured');
    err.status = 503;
    throw err;
  }
  if (!header) {
    const err = new Error('Missing Stripe-Signature');
    err.status = 400;
    throw err;
  }
  const parts = {};
  for (const item of header.split(',')) {
    const idx = item.indexOf('=');
    if (idx === -1) continue;
    const key = item.slice(0, idx).trim();
    const value = item.slice(idx + 1).trim();
    if (!parts[key]) parts[key] = [];
    parts[key].push(value);
  }
  const timestamp = parts.t && parts.t[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) {
    const err = new Error('Invalid Stripe-Signature');
    err.status = 400;
    throw err;
  }
  const ageMs = Math.abs(nowMs - Number(timestamp) * 1000);
  if (!Number.isFinite(Number(timestamp)) || ageMs > 5 * 60 * 1000) {
    const err = new Error('Stripe webhook timestamp too old');
    err.status = 400;
    throw err;
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  const expected = hexFromBuffer(mac);
  if (!signatures.some((sig) => timingSafeEqualHex(expected, sig))) {
    const err = new Error('Invalid Stripe webhook signature');
    err.status = 400;
    throw err;
  }
}

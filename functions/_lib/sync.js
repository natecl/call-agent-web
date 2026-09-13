import { getPlan } from './plans.js';
import { assertPhone } from './phone.js';
import { retainIsOn } from './retain.js';
import { stripeRequest } from './stripe.js';

export const DEFAULT_SYNC_URL = 'https://hidden-beacon-080.fly.dev/accounts/sync';
export const DEFAULT_DASHBOARD_URL = 'https://hidden-beacon-080.fly.dev/accounts/dashboard';
export const ACCOUNT_SYNC_SIGNATURE_HEADER = 'X-Account-Sync-Signature';

export const FIRST_NAME_RE = /^[A-Za-z][A-Za-z' -]{0,31}$/;
const SYNC_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'customer.updated',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);
const RETRY_DELAYS_MS = [0, 200, 400];

export function accountSyncUrl(env) {
  const explicit = String((env && env.CALL_AGENT_SYNC_URL) || '').trim();
  if (explicit) return explicit;
  const base = String((env && env.PUBLIC_BASE_URL) || '').trim();
  if (base) return `${base.replace(/\/$/, '')}/accounts/sync`;
  return DEFAULT_SYNC_URL;
}

export function accountDashboardUrl(env) {
  const explicit = String((env && env.CALL_AGENT_DASHBOARD_URL) || '').trim();
  if (explicit) return explicit;
  const sync = accountSyncUrl(env);
  if (sync.endsWith('/accounts/sync')) {
    return `${sync.slice(0, -'/accounts/sync'.length)}/accounts/dashboard`;
  }
  try {
    const url = new URL(sync);
    url.pathname = '/accounts/dashboard';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_DASHBOARD_URL;
  }
}

export function firstNameFrom(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return FIRST_NAME_RE.test(first) ? first : null;
}

export function assertName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    const err = new Error('A name is required');
    err.status = 400;
    throw err;
  }
  const firstName = firstNameFrom(trimmed);
  if (!firstName) {
    const err = new Error('Use a first name, like Nathan');
    err.status = 400;
    throw err;
  }
  return { name: trimmed, firstName };
}

export function isoFromStripeCreated(value) {
  if (value == null || value === '') return new Date().toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  return raw;
}

function hexFromBuffer(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signAccountSync(secret, body) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = typeof body === 'string' ? encoder.encode(body) : body;
  const mac = await crypto.subtle.sign('HMAC', key, bytes);
  return `sha256=${hexFromBuffer(mac)}`;
}

export function payloadFromStripeCustomer(customer, { eventCreated } = {}) {
  if (!customer || !customer.id) {
    const err = new Error('Stripe Customer is missing');
    err.status = 400;
    throw err;
  }
  const metadata = customer.metadata || {};
  const phone = assertPhone(customer.phone || metadata.phone);
  const name = String(customer.name || '').trim();
  const plan = getPlan(metadata.plan);
  const minutesRaw = plan ? plan.minutes : Number(metadata.minutes);
  const payload = {
    phone,
    stripe_customer_id: customer.id,
    minutes_included: Number.isFinite(minutesRaw) ? minutesRaw : 0,
    retain_call_artifacts: retainIsOn(metadata.retain_after_call),
  };
  if (plan) payload.plan = plan.id;
  else if (metadata.plan) payload.plan = String(metadata.plan);
  const firstName = firstNameFrom(name);
  if (firstName) payload.first_name = firstName;
  if (name) payload.prefs = { full_name: name };
  payload.stripe_event_created = isoFromStripeCreated(eventCreated);
  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function postAccountSync(env, payload, fetchImpl, { required = false } = {}) {
  const secret = String((env && env.ACCOUNT_SYNC_SECRET) || '').trim();
  if (!secret) {
    if (required) throw fail('Account sync is not configured', 503);
    return { skipped: true, reason: 'missing secret' };
  }
  const url = accountSyncUrl(env);
  const body = JSON.stringify(payload);
  const signature = await signAccountSync(secret, body);
  const fetchFn = fetchImpl || fetch;
  let lastError = fail('Fly account sync failed', 502);
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt]) await sleep(RETRY_DELAYS_MS[attempt]);
    let res;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [ACCOUNT_SYNC_SIGNATURE_HEADER]: signature,
        },
        body,
      });
    } catch (error) {
      lastError = fail(error && error.message ? error.message : 'Fly account sync failed', 502);
      continue;
    }
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (res.status >= 500) {
      lastError = fail((data && data.error) || 'Fly account sync failed', 502);
      continue;
    }
    if (!res.ok) {
      throw fail((data && (data.error || data.detail)) || 'Fly account sync rejected', res.status);
    }
    return data;
  }
  throw lastError;
}

export async function getAccountDashboard(env, phone, fetchImpl, { required = false } = {}) {
  const secret = String((env && env.ACCOUNT_SYNC_SECRET) || '').trim();
  if (!secret) {
    if (required) throw fail('Account sync is not configured', 503);
    return { skipped: true, reason: 'missing secret', ok: true, user: null, threads: [], calls: [] };
  }
  const e164 = assertPhone(phone);
  const url = `${accountDashboardUrl(env)}?phone=${encodeURIComponent(e164)}`;
  const signature = await signAccountSync(secret, e164);
  const fetchFn = fetchImpl || fetch;
  let lastError = fail('Fly account dashboard failed', 502);
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt]) await sleep(RETRY_DELAYS_MS[attempt]);
    let res;
    try {
      res = await fetchFn(url, {
        method: 'GET',
        headers: {
          [ACCOUNT_SYNC_SIGNATURE_HEADER]: signature,
        },
      });
    } catch (error) {
      lastError = fail(error && error.message ? error.message : 'Fly account dashboard failed', 502);
      continue;
    }
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (res.status >= 500) {
      lastError = fail((data && (data.error || data.detail)) || 'Fly account dashboard failed', 502);
      continue;
    }
    if (!res.ok) {
      throw fail((data && (data.error || data.detail)) || 'Fly account dashboard rejected', res.status);
    }
    return {
      ok: data.ok !== false,
      user: data.user || null,
      threads: Array.isArray(data.threads) ? data.threads : [],
      calls: Array.isArray(data.calls) ? data.calls : [],
    };
  }
  throw lastError;
}

function customerIdOf(obj) {
  if (!obj) return '';
  if (typeof obj.customer === 'string') return obj.customer;
  if (obj.customer && obj.customer.id) return obj.customer.id;
  if (typeof obj.id === 'string' && obj.id.startsWith('cus_')) return obj.id;
  return '';
}

async function retrieveCustomer(env, customerId, fetchImpl) {
  const id = String(customerId || '').trim();
  if (!id) return null;
  return stripeRequest(env, {
    method: 'GET',
    path: `customers/${encodeURIComponent(id)}`,
    fetchImpl,
  });
}

function customerFromCheckoutSession(session) {
  const customerId = customerIdOf(session);
  if (!customerId) return null;
  const details = session.customer_details || {};
  const metadata = session.metadata || {};
  return {
    id: customerId,
    name: metadata.name || details.name || '',
    phone: metadata.phone || details.phone || '',
    metadata,
  };
}

export async function syncFromStripeEvent(env, event, fetchImpl) {
  const type = event && event.type ? event.type : '';
  if (!SYNC_EVENT_TYPES.has(type)) return { skipped: true, reason: 'ignored type' };
  if (!String((env && env.ACCOUNT_SYNC_SECRET) || '').trim()) {
    return { skipped: true, reason: 'missing secret' };
  }
  const obj = event.data && event.data.object ? event.data.object : {};
  let customer = null;
  if (type === 'customer.updated') {
    customer = obj;
  } else if (type === 'checkout.session.completed') {
    try {
      customer = await retrieveCustomer(env, customerIdOf(obj), fetchImpl);
    } catch {
      customer = null;
    }
    if (!customer) customer = customerFromCheckoutSession(obj);
  } else {
    customer = await retrieveCustomer(env, customerIdOf(obj), fetchImpl);
  }
  if (!customer) return { skipped: true, reason: 'no customer' };
  let payload;
  try {
    payload = payloadFromStripeCustomer(customer, { eventCreated: event.created });
  } catch (error) {
    if (error && error.status === 400) return { skipped: true, reason: error.message };
    throw error;
  }
  return postAccountSync(env, payload, fetchImpl);
}

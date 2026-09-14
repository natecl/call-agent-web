import { verifyCheckoutSession } from './checkout.js';
import { readSession } from './auth.js';
import { resolveAccount } from './stripe_account.js';

export { assertUserPhone, reservedAccountPhones, DEFAULT_TELNYX_FROM_E164 } from './phone.js';
export { marketingEntryPath, loginEntryPath, shouldRouteToDashboard } from './route.js';

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

export function readCsrfHeader(request) {
  return String(
    (request && request.headers && (request.headers.get('X-Treena-CSRF') || request.headers.get('x-treena-csrf'))) || '',
  ).trim();
}

export function csrfFromBody(body) {
  if (!body || typeof body !== 'object') return '';
  return String(body.csrf || body.csrfToken || '').trim();
}

export function assertCsrf(request, session, body) {
  if (!session || !session.csrf) throw fail('Sign in to continue', 401);
  const provided = readCsrfHeader(request) || csrfFromBody(body);
  if (!provided || !timingSafeEqual(provided, session.csrf)) {
    throw fail('Invalid CSRF token', 403);
  }
}

export async function viewFromCheckoutOrEmail(env, { sessionId, email, name, phone }, fetchImpl) {
  if (sessionId) return verifyCheckoutSession(env, sessionId, fetchImpl);
  if (!email) return null;
  const account = await resolveAccount(env, { email, name, phone }, fetchImpl);
  if (!account || !account.hasAccount) return null;
  return account;
}

function mutating(request) {
  const method = String((request && request.method) || 'GET').toUpperCase();
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

export async function requireAccountOwner(env, request, body = {}, fetchImpl) {
  const sessionId = String(
    (body && (body.sessionId || body.session_id))
    || (request && new URL(request.url).searchParams.get('session_id'))
    || '',
  ).trim();
  const auth = request ? await readSession(env, request) : null;
  if (mutating(request) && auth && auth.csrf) {
    assertCsrf(request, auth, body);
  }
  let view = null;
  if (sessionId) {
    view = await verifyCheckoutSession(env, sessionId, fetchImpl);
  }
  if (auth && auth.email) {
    if (view && view.email && view.email !== auth.email) {
      throw fail('This checkout session belongs to a different account', 403);
    }
    if (!view) {
      view = await viewFromCheckoutOrEmail(env, {
        email: auth.email,
        name: auth.name,
        phone: auth.phone,
      }, fetchImpl);
    }
    if (!view) {
      throw fail('No Treena account for this sign-in', 404);
    }
    return {
      auth,
      view,
      email: view.email || auth.email,
      customerId: view.customerId || auth.customerId || null,
      phone: view.phone || auth.phone || null,
      csrf: auth.csrf || null,
    };
  }
  if (view) {
    return {
      auth: null,
      view,
      email: view.email,
      customerId: view.customerId || null,
      phone: view.phone || null,
      csrf: null,
    };
  }
  throw fail('Sign in to continue', 401);
}

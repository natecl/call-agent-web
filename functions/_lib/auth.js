const AUTH_COOKIE = 'treena_auth';
const STATE_COOKIE = 'treena_oauth_state';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const STATE_MAX_AGE = 10 * 60;
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';
const APPLE_AUTH = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN = 'https://appleid.apple.com/auth/token';
const APPLE_KEYS = 'https://appleid.apple.com/auth/keys';

function fail(message, status, extra) {
  const err = new Error(message);
  err.status = status;
  if (extra) Object.assign(err, extra);
  return err;
}

function textOf(env, key) {
  return String((env && env[key]) || '').trim();
}

function b64urlEncode(bytes) {
  const buffer = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = '';
  for (let i = 0; i < buffer.length; i += 1) binary += String.fromCharCode(buffer[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(value) {
  const padded = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8(text) {
  return new TextEncoder().encode(text);
}

function fromUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

export function publicOrigin(request, env = {}) {
  const explicit = textOf(env, 'AUTH_PUBLIC_ORIGIN').replace(/\/+$/, '');
  if (explicit) return explicit;
  return new URL(request.url).origin;
}

export function safeNextPath(raw, fallback = '/account.html?plan=personal') {
  const value = String(raw || '').trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('\\')) return fallback;
  return value;
}

export function googleMissing(env = {}) {
  const missing = [];
  if (!textOf(env, 'GOOGLE_CLIENT_ID')) missing.push('GOOGLE_CLIENT_ID');
  if (!textOf(env, 'GOOGLE_CLIENT_SECRET')) missing.push('GOOGLE_CLIENT_SECRET');
  if (!textOf(env, 'AUTH_SESSION_SECRET')) missing.push('AUTH_SESSION_SECRET');
  return missing;
}

export function appleMissing(env = {}) {
  const missing = [];
  if (!textOf(env, 'APPLE_CLIENT_ID')) missing.push('APPLE_CLIENT_ID');
  if (!textOf(env, 'APPLE_TEAM_ID')) missing.push('APPLE_TEAM_ID');
  if (!textOf(env, 'APPLE_KEY_ID')) missing.push('APPLE_KEY_ID');
  if (!textOf(env, 'APPLE_PRIVATE_KEY')) missing.push('APPLE_PRIVATE_KEY');
  if (!textOf(env, 'AUTH_SESSION_SECRET')) missing.push('AUTH_SESSION_SECRET');
  return missing;
}

export function oauthStatus(env = {}) {
  const google = googleMissing(env);
  const apple = appleMissing(env);
  return {
    google: google.length === 0,
    apple: apple.length === 0,
    missing: { google, apple },
  };
}

async function hmacBytes(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, typeof data === 'string' ? utf8(data) : data);
}

export async function signPayload(secret, payload) {
  const body = b64urlEncode(utf8(JSON.stringify(payload)));
  const mac = b64urlEncode(await hmacBytes(secret, body));
  return `${body}.${mac}`;
}

export async function verifyPayload(secret, token) {
  const raw = String(token || '');
  const idx = raw.lastIndexOf('.');
  if (idx < 1) throw fail('Invalid auth token', 401);
  const body = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  const expected = b64urlEncode(await hmacBytes(secret, body));
  if (expected.length !== mac.length) throw fail('Invalid auth token', 401);
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  if (mismatch) throw fail('Invalid auth token', 401);
  let payload;
  try {
    payload = JSON.parse(fromUtf8(b64urlDecode(body)));
  } catch {
    throw fail('Invalid auth token', 401);
  }
  if (payload.exp && Date.now() / 1000 > Number(payload.exp)) throw fail('Auth session expired', 401);
  return payload;
}

function cookieHeader(name, value, { maxAge, secure }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader(name, { secure }) {
  return cookieHeader(name, '', { maxAge: 0, secure });
}

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export async function readSession(env, request) {
  const secret = textOf(env, 'AUTH_SESSION_SECRET');
  if (!secret) return null;
  const token = parseCookies(request)[AUTH_COOKIE];
  if (!token) return null;
  try {
    return await verifyPayload(secret, token);
  } catch {
    return null;
  }
}

function sessionPayload({ email, provider, sub, name }) {
  const now = Math.floor(Date.now() / 1000);
  return {
    email: String(email || '').trim().toLowerCase(),
    provider,
    sub: String(sub || ''),
    name: String(name || '').trim() || null,
    iat: now,
    exp: now + SESSION_MAX_AGE,
  };
}

export function sessionCookies(origin, env, sessionToken, stateToken) {
  const secure = String(origin || '').startsWith('https:');
  const headers = [];
  if (sessionToken) headers.push(cookieHeader(AUTH_COOKIE, sessionToken, { maxAge: SESSION_MAX_AGE, secure }));
  if (stateToken) headers.push(cookieHeader(STATE_COOKIE, stateToken, { maxAge: STATE_MAX_AGE, secure }));
  if (sessionToken === '' && env) headers.push(clearCookieHeader(AUTH_COOKIE, { secure }));
  return headers;
}

export function logoutCookies(origin) {
  const secure = String(origin || '').startsWith('https:');
  return [
    clearCookieHeader(AUTH_COOKIE, { secure }),
    clearCookieHeader(STATE_COOKIE, { secure }),
  ];
}

export function redirect(url, cookies = []) {
  const headers = { Location: url, 'cache-control': 'no-store' };
  const res = new Response(null, { status: 302, headers });
  for (const cookie of cookies) res.headers.append('Set-Cookie', cookie);
  return res;
}

export function loginErrorRedirect(origin, message, missing) {
  const params = new URLSearchParams();
  params.set('auth_error', message);
  if (missing && missing.length) params.set('missing', missing.join(','));
  return redirect(`${origin}/login?${params.toString()}`);
}

export function callbackErrorRedirect(origin, message) {
  return loginErrorRedirect(origin, message);
}

function googleRedirectUri(origin) {
  return `${origin}/api/auth/google/callback`;
}

function appleRedirectUri(origin) {
  return `${origin}/api/auth/apple/callback`;
}

export async function startGoogleOAuth(env, request) {
  const missing = googleMissing(env);
  const origin = publicOrigin(request, env);
  if (missing.length) {
    return loginErrorRedirect(origin, 'Google OAuth is not configured', missing);
  }
  const next = safeNextPath(new URL(request.url).searchParams.get('next'));
  const state = await signPayload(textOf(env, 'AUTH_SESSION_SECRET'), {
    provider: 'google',
    next,
    n: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + STATE_MAX_AGE,
  });
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id', textOf(env, 'GOOGLE_CLIENT_ID'));
  url.searchParams.set('redirect_uri', googleRedirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return redirect(url.toString(), sessionCookies(origin, env, null, state));
}

export async function startAppleOAuth(env, request) {
  const missing = appleMissing(env);
  const origin = publicOrigin(request, env);
  if (missing.length) {
    return loginErrorRedirect(origin, 'Apple sign-in is not configured', missing);
  }
  const next = safeNextPath(new URL(request.url).searchParams.get('next'));
  const state = await signPayload(textOf(env, 'AUTH_SESSION_SECRET'), {
    provider: 'apple',
    next,
    n: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + STATE_MAX_AGE,
  });
  const url = new URL(APPLE_AUTH);
  url.searchParams.set('client_id', textOf(env, 'APPLE_CLIENT_ID'));
  url.searchParams.set('redirect_uri', appleRedirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'form_post');
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', state);
  return redirect(url.toString(), sessionCookies(origin, env, null, state));
}

async function requireState(env, request, provider, incomingState) {
  const secret = textOf(env, 'AUTH_SESSION_SECRET');
  const cookieState = parseCookies(request)[STATE_COOKIE];
  const token = String(incomingState || cookieState || '');
  if (!token) throw fail('Missing OAuth state', 400);
  const payload = await verifyPayload(secret, token);
  if (payload.provider !== provider) throw fail('OAuth state mismatch', 400);
  if (cookieState && cookieState !== token) throw fail('OAuth state mismatch', 400);
  return payload;
}

async function finishSession(env, request, { email, provider, sub, name, next }) {
  const origin = publicOrigin(request, env);
  if (!email) throw fail('That sign-in did not return an email', 400);
  const token = await signPayload(textOf(env, 'AUTH_SESSION_SECRET'), sessionPayload({
    email,
    provider,
    sub,
    name,
  }));
  const cookies = sessionCookies(origin, env, token, '');
  cookies.push(clearCookieHeader(STATE_COOKIE, { secure: origin.startsWith('https:') }));
  return redirect(`${origin}${safeNextPath(next)}`, cookies);
}

export async function handleGoogleCallback(env, request, fetchImpl) {
  const missing = googleMissing(env);
  const origin = publicOrigin(request, env);
  if (missing.length) return loginErrorRedirect(origin, 'Google OAuth is not configured', missing);
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) return callbackErrorRedirect(origin, `Google sign-in was cancelled (${error})`);
  const code = url.searchParams.get('code');
  if (!code) return callbackErrorRedirect(origin, 'Google sign-in did not return a code');
  let statePayload;
  try {
    statePayload = await requireState(env, request, 'google', url.searchParams.get('state'));
  } catch (error) {
    return callbackErrorRedirect(origin, error.message || 'Invalid Google sign-in state');
  }
  const fetchFn = fetchImpl || fetch;
  const tokenRes = await fetchFn(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: textOf(env, 'GOOGLE_CLIENT_ID'),
      client_secret: textOf(env, 'GOOGLE_CLIENT_SECRET'),
      redirect_uri: googleRedirectUri(origin),
      grant_type: 'authorization_code',
    }).toString(),
  });
  const tokenBody = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    return callbackErrorRedirect(origin, tokenBody.error_description || 'Google token exchange failed');
  }
  const userRes = await fetchFn(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  const user = await userRes.json().catch(() => ({}));
  if (!userRes.ok) return callbackErrorRedirect(origin, 'Google profile lookup failed');
  try {
    return await finishSession(env, request, {
      email: user.email,
      provider: 'google',
      sub: user.sub,
      name: user.name || user.given_name,
      next: statePayload.next,
    });
  } catch (error) {
    return callbackErrorRedirect(origin, error.message || 'Google sign-in failed');
  }
}

function normalizePem(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/^\uFEFF/, '')
    .trim();
}

function b64Decode(value) {
  const padded = String(value || '');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pemToPkcs8(pem) {
  const cleaned = normalizePem(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return b64Decode(cleaned);
}

async function appleClientSecret(env) {
  const pem = normalizePem(textOf(env, 'APPLE_PRIVATE_KEY'));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(utf8(JSON.stringify({ alg: 'ES256', kid: textOf(env, 'APPLE_KEY_ID') })));
  const payload = b64urlEncode(utf8(JSON.stringify({
    iss: textOf(env, 'APPLE_TEAM_ID'),
    iat: now,
    exp: now + 86000,
    aud: 'https://appleid.apple.com',
    sub: textOf(env, 'APPLE_CLIENT_ID'),
  })));
  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(signingInput));
  return `${signingInput}.${b64urlEncode(sig)}`;
}

function decodeJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return {};
  try {
    return JSON.parse(fromUtf8(b64urlDecode(parts[1])));
  } catch {
    return {};
  }
}

async function verifyAppleIdToken(idToken, clientId, fetchImpl) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw fail('Invalid Apple identity token', 400);
  const header = JSON.parse(fromUtf8(b64urlDecode(parts[0])));
  const payload = JSON.parse(fromUtf8(b64urlDecode(parts[1])));
  if (payload.iss !== 'https://appleid.apple.com') throw fail('Invalid Apple token issuer', 400);
  if (payload.aud !== clientId) throw fail('Invalid Apple token audience', 400);
  if (payload.exp && Date.now() / 1000 > Number(payload.exp)) throw fail('Apple token expired', 400);
  const fetchFn = fetchImpl || fetch;
  const keysRes = await fetchFn(APPLE_KEYS);
  const keysBody = await keysRes.json().catch(() => ({}));
  const jwk = (keysBody.keys || []).find((key) => key.kid === header.kid);
  if (!jwk) throw fail('Apple signing key not found', 400);
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    b64urlDecode(parts[2]),
    utf8(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw fail('Apple identity token signature failed', 400);
  return payload;
}

function appleNameFrom(form) {
  const raw = form.get('user');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    const name = parsed.name || {};
    return [name.firstName, name.lastName].filter(Boolean).join(' ').trim();
  } catch {
    return '';
  }
}

export async function handleAppleCallback(env, request, fetchImpl) {
  const missing = appleMissing(env);
  const origin = publicOrigin(request, env);
  if (missing.length) return loginErrorRedirect(origin, 'Apple sign-in is not configured', missing);
  const form = request.method === 'POST'
    ? new URLSearchParams(await request.text())
    : new URL(request.url).searchParams;
  if (form.get('error')) {
    return callbackErrorRedirect(origin, `Apple sign-in was cancelled (${form.get('error')})`);
  }
  const code = form.get('code');
  if (!code) return callbackErrorRedirect(origin, 'Apple sign-in did not return a code');
  let statePayload;
  try {
    statePayload = await requireState(env, request, 'apple', form.get('state'));
  } catch (error) {
    return callbackErrorRedirect(origin, error.message || 'Invalid Apple sign-in state');
  }
  let clientSecret;
  try {
    clientSecret = await appleClientSecret(env);
  } catch {
    return callbackErrorRedirect(origin, 'APPLE_PRIVATE_KEY could not be used to sign a client secret');
  }
  const fetchFn = fetchImpl || fetch;
  const tokenRes = await fetchFn(APPLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: textOf(env, 'APPLE_CLIENT_ID'),
      client_secret: clientSecret,
      redirect_uri: appleRedirectUri(origin),
    }).toString(),
  });
  const tokenBody = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    return callbackErrorRedirect(origin, tokenBody.error_description || 'Apple token exchange failed');
  }
  let claims = decodeJwt(tokenBody.id_token);
  try {
    claims = await verifyAppleIdToken(tokenBody.id_token, textOf(env, 'APPLE_CLIENT_ID'), fetchFn);
  } catch (error) {
    if (error && error.status === 400) return callbackErrorRedirect(origin, error.message);
    claims = decodeJwt(tokenBody.id_token);
  }
  const email = claims.email || form.get('email');
  const name = appleNameFrom(form);
  try {
    return await finishSession(env, request, {
      email,
      provider: 'apple',
      sub: claims.sub,
      name,
      next: statePayload.next,
    });
  } catch (error) {
    return callbackErrorRedirect(origin, error.message || 'Apple sign-in failed');
  }
}

export async function sessionView(env, request) {
  const session = await readSession(env, request);
  if (!session || !session.email) {
    return { ok: true, signedIn: false, oauth: oauthStatus(env) };
  }
  return {
    ok: true,
    signedIn: true,
    email: session.email,
    provider: session.provider,
    name: session.name,
    oauth: oauthStatus(env),
  };
}

export function routeParts(params) {
  const raw = params && params.path;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw) return raw.split('/').filter(Boolean);
  return [];
}

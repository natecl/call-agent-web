import { errorResponse, json } from '../../_lib/http.js';
import {
  handleAppleCallback,
  handleGoogleCallback,
  logoutCookies,
  publicOrigin,
  redirect,
  routeParts,
  sessionView,
  startAppleOAuth,
  startGoogleOAuth,
} from '../../_lib/auth.js';

function methodOf(request) {
  return String(request.method || 'GET').toUpperCase();
}

export async function onRequest(context) {
  try {
    const env = context.env || {};
    const request = context.request;
    const method = methodOf(request);
    const parts = routeParts(context.params);
    const route = parts.join('/');

    if (route === 'me' && method === 'GET') {
      return json(await sessionView(env, request));
    }

    if (route === 'logout' && (method === 'GET' || method === 'POST')) {
      const origin = publicOrigin(request, env);
      const next = new URL(request.url).searchParams.get('next') || '/';
      const target = next.startsWith('/') && !next.startsWith('//') ? `${origin}${next}` : `${origin}/`;
      return redirect(target, logoutCookies(origin));
    }

    if (route === 'google' && method === 'GET') {
      return startGoogleOAuth(env, request);
    }
    if (route === 'google/callback' && method === 'GET') {
      return handleGoogleCallback(env, request);
    }

    if (route === 'apple' && method === 'GET') {
      return startAppleOAuth(env, request);
    }
    if (route === 'apple/callback' && (method === 'GET' || method === 'POST')) {
      return handleAppleCallback(env, request);
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

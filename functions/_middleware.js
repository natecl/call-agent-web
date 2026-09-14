import { marketingEntryPath, loginEntryPath, shouldRouteToDashboard } from './_lib/route.js';
import { publicOrigin, readSession, redirect } from './_lib/auth.js';

export async function onRequest(context) {
  const request = context.request;
  if (String(request.method || 'GET').toUpperCase() !== 'GET') return context.next();
  const url = new URL(request.url);
  if (!marketingEntryPath(url.pathname) && !loginEntryPath(url.pathname)) {
    return context.next();
  }
  try {
    const session = await readSession(context.env || {}, request);
    if (!shouldRouteToDashboard(session, url.pathname)) return context.next();
    const origin = publicOrigin(request, context.env || {});
    return redirect(`${origin}/dashboard`);
  } catch {
    return context.next();
  }
}

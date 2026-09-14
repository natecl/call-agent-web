import { loadDashboard } from '../_lib/dashboard.js';
import { errorResponse, json } from '../_lib/http.js';
import { requireAccountOwner } from '../_lib/identity.js';
import { issueAccountSession } from '../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const owner = await requireAccountOwner(context.env, context.request, {
      sessionId: url.searchParams.get('session_id'),
    });
    const result = await loadDashboard(context.env, {
      view: owner.view,
      sessionId: owner.view.sessionId || url.searchParams.get('session_id'),
      csrf: owner.csrf,
    });
    const issued = await issueAccountSession(context.env, context.request, {
      email: result.email || owner.email,
      name: result.name,
      phone: result.phone,
      customerId: result.billing && result.billing.customerId,
      hasAccount: true,
    });
    return json({ ...result, csrf: issued.csrf || owner.csrf }, 200, { cookies: issued.cookies });
  } catch (error) {
    return errorResponse(error);
  }
}
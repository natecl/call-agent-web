import { billingView } from '../_lib/dashboard.js';
import { errorResponse, json } from '../_lib/http.js';
import { requireAccountOwner } from '../_lib/identity.js';
import { issueAccountSession } from '../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const owner = await requireAccountOwner(context.env, context.request, {
      sessionId: url.searchParams.get('session_id'),
    });
    const billing = await billingView(context.env, owner.view);
    const issued = await issueAccountSession(context.env, context.request, {
      email: owner.email,
      name: owner.view.name,
      phone: owner.phone,
      customerId: billing.customerId || owner.customerId,
      hasAccount: true,
    });
    return json({ ok: true, csrf: issued.csrf || owner.csrf, ...billing }, 200, { cookies: issued.cookies });
  } catch (error) {
    return errorResponse(error);
  }
}
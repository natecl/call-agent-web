import { errorResponse, json } from '../_lib/http.js';
import { issueAccountSession } from '../_lib/auth.js';
import { requireAccountOwner } from '../_lib/identity.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const owner = await requireAccountOwner(context.env, context.request, {
      sessionId: url.searchParams.get('session_id'),
    });
    const view = owner.view;
    const issued = await issueAccountSession(context.env, context.request, {
      email: owner.email,
      name: view.name,
      phone: view.phone || owner.phone,
      customerId: owner.customerId,
      hasAccount: true,
      checkoutSessionId: view.sessionId,
    });
    const sessionId = view.sessionId
      || (issued.payload && issued.payload.checkoutSessionId)
      || null;
    return json({ ...view, sessionId, csrf: issued.csrf || owner.csrf }, 200, { cookies: issued.cookies });
  } catch (error) {
    return errorResponse(error);
  }
}
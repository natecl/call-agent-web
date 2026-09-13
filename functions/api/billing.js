import { verifyCheckoutSession } from '../_lib/checkout.js';
import { billingView } from '../_lib/dashboard.js';
import { errorResponse, json } from '../_lib/http.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get('session_id');
    const session = await verifyCheckoutSession(context.env, sessionId);
    const billing = await billingView(context.env, session);
    return json({ ok: true, ...billing });
  } catch (error) {
    return errorResponse(error);
  }
}

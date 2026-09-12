import { errorResponse, json } from '../_lib/http.js';
import { getPlan } from '../_lib/plans.js';
import { verifyStripeWebhook } from '../_lib/stripe.js';
import { syncFromStripeEvent } from '../_lib/sync.js';

export async function onRequestPost(context) {
  try {
    const payload = await context.request.text();
    const header = context.request.headers.get('Stripe-Signature');
    await verifyStripeWebhook(context.env.STRIPE_WEBHOOK_SECRET, payload, header);
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      const err = new Error('Invalid webhook JSON');
      err.status = 400;
      throw err;
    }
    const type = event.type || '';
    const obj = event.data && event.data.object ? event.data.object : {};
    if (type === 'checkout.session.completed') {
      const planId = (obj.metadata && obj.metadata.plan) || obj.client_reference_id;
      if (planId && !getPlan(planId)) {
        const err = new Error('Unknown plan on webhook');
        err.status = 400;
        throw err;
      }
    }
    const sync = await syncFromStripeEvent(context.env, event);
    return json({ received: true, type, sync });
  } catch (error) {
    return errorResponse(error);
  }
}

import { getPlan } from '../_lib/plans.js';
import { errorResponse, json } from '../_lib/http.js';
import { verifyStripeWebhook } from '../_lib/stripe.js';

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
    return json({ received: true, type });
  } catch (error) {
    return errorResponse(error);
  }
}

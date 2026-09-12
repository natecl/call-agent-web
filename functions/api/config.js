import { PLANS } from '../_lib/plans.js';
import { errorResponse, json } from '../_lib/http.js';
import { requireTestPublishable, requireTestSecret } from '../_lib/stripe.js';

export async function onRequestGet(context) {
  try {
    const env = context.env || {};
    let configured = false;
    try {
      requireTestSecret(env.STRIPE_SECRET_KEY);
      configured = true;
    } catch (error) {
      if (error.message === 'Live Stripe keys are not allowed') throw error;
      configured = false;
    }
    const publishableKey = requireTestPublishable(env.STRIPE_PUBLISHABLE_KEY);
    return json({
      mode: 'test',
      configured,
      publishableKey: publishableKey || null,
      prices: {
        personal: Boolean(env.STRIPE_PRICE_PERSONAL),
        plus: Boolean(env.STRIPE_PRICE_PLUS),
      },
      plans: Object.values(PLANS).map((plan) => ({
        id: plan.id,
        name: plan.name,
        amountCents: plan.amountCents,
        minutes: plan.minutes,
        overage: plan.overage,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

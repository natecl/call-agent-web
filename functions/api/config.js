import { PLANS } from '../_lib/plans.js';
import { errorResponse, json } from '../_lib/http.js';
import { stripeView } from '../_lib/stripe.js';
import { treenaIMessageView } from '../_lib/imessage.js';
import { oauthStatus } from '../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const env = context.env || {};
    const stripe = stripeView(env);
    return json({
      mode: stripe.mode,
      stripeLive: stripe.stripeLive,
      configured: stripe.configured,
      publishableKey: stripe.publishableKey,
      webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
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
      imessage: treenaIMessageView(env),
      oauth: oauthStatus(env),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

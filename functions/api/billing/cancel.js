import { cancelSubscriptionAtPeriodEnd } from '../../_lib/billing.js';
import { errorResponse, json, readJson } from '../../_lib/http.js';
import { requireAccountOwner } from '../../_lib/identity.js';

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const owner = await requireAccountOwner(context.env, context.request, body);
    const subscriptionId = owner.view.subscriptionId;
    const result = await cancelSubscriptionAtPeriodEnd(context.env, { subscriptionId });
    return json({
      ...result,
      csrf: owner.csrf,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
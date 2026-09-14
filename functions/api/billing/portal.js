import { createBillingPortalSession } from '../../_lib/billing.js';
import { errorResponse, json, readJson } from '../../_lib/http.js';
import { requireAccountOwner } from '../../_lib/identity.js';
import { publicOrigin } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const owner = await requireAccountOwner(context.env, context.request, body);
    const origin = publicOrigin(context.request, context.env);
    const result = await createBillingPortalSession(context.env, {
      customerId: owner.customerId,
      origin,
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
import { createBillingPortalSession } from '../../_lib/billing.js';
import { errorResponse, json, readJson } from '../../_lib/http.js';
import { assertCsrf, requireAccountOwner } from '../../_lib/identity.js';
import { publicOrigin, readSession } from '../../_lib/auth.js';
import { isComplimentaryEmail, isComplimentaryGrant } from '../../_lib/entitlement.js';
import { lookupPaidAccount, markComplimentary } from '../../_lib/stripe_account.js';

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const auth = await readSession(context.env, context.request);
    if (auth && auth.csrf) assertCsrf(context.request, auth, body);
    // Complimentary grants have no Checkout Session. Refuse portal before
    // session-id verification so they never see "Missing live Checkout Session".
    if (auth && auth.email && isComplimentaryEmail(context.env, auth.email)) {
      const account = await lookupPaidAccount(context.env, auth.email);
      const grant = account || markComplimentary(null, context.env, auth.email);
      if (isComplimentaryGrant(grant)) {
        throw fail('Complimentary accounts do not use Stripe Customer Portal', 403);
      }
    }
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
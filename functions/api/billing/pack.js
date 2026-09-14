import { createMinutePackCheckout } from '../../_lib/checkout.js';
import { loadDashboard } from '../../_lib/dashboard.js';
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
    if (auth && auth.email && isComplimentaryEmail(context.env, auth.email)) {
      const account = await lookupPaidAccount(context.env, auth.email);
      const grant = account || markComplimentary(null, context.env, auth.email);
      if (isComplimentaryGrant(grant)) {
        throw fail('Complimentary accounts do not purchase minute packs', 403);
      }
    }
    const owner = await requireAccountOwner(context.env, context.request, body);
    if (owner.view && owner.view.complimentary) {
      throw fail('Complimentary accounts do not purchase minute packs', 403);
    }
    const dash = await loadDashboard(context.env, {
      view: owner.view,
      sessionId: owner.view && owner.view.sessionId,
      csrf: owner.csrf,
    });
    const pack = (dash.usage && dash.usage.pack) || {};
    if (pack.atPackCap) {
      throw fail(pack.gatedReason || 'Pack cap reached (60 min / 12 packs this period).', 409);
    }
    if (!pack.canPurchase) {
      throw fail(pack.gatedReason || 'Cannot purchase a minute pack', 403);
    }
    const origin = publicOrigin(context.request, context.env);
    const result = await createMinutePackCheckout(context.env, {
      origin,
      customerId: owner.customerId,
      email: owner.email,
      phone: owner.phone || (owner.view && owner.view.phone),
      prepaidMinutes: dash.usage && dash.usage.prepaidMinutes,
    });
    return json({ ...result, csrf: owner.csrf });
  } catch (error) {
    return errorResponse(error);
  }
}

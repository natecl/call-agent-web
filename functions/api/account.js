import { saveAccountSettings } from '../_lib/checkout.js';
import { errorResponse, json, readJson } from '../_lib/http.js';
import { requireAccountOwner } from '../_lib/identity.js';
import { issueAccountSession } from '../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const owner = await requireAccountOwner(context.env, context.request, {
      sessionId: url.searchParams.get('session_id'),
    });
    const view = owner.view;
    return json({
      ok: true,
      email: owner.email,
      name: view.name || null,
      firstName: view.firstName || null,
      phone: view.phone || owner.phone,
      plan: view.plan || null,
      retainAfterCall: view.retainAfterCall || 'off',
      customerId: owner.customerId,
      csrf: owner.csrf,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const owner = await requireAccountOwner(context.env, context.request, body);
    const result = await saveAccountSettings(context.env, {
      email: owner.email,
      customerId: owner.customerId,
      name: body.name,
      phone: body.phone || owner.phone,
      planId: body.plan,
      retainAfterCall: body.retainAfterCall,
    });
    const issued = await issueAccountSession(context.env, context.request, {
      email: owner.email,
      name: result.name,
      phone: result.phone,
      customerId: result.customerId,
      hasAccount: true,
      checkoutSessionId: owner.view && owner.view.sessionId,
    });
    return json({ ...result, csrf: issued.csrf || owner.csrf }, 200, { cookies: issued.cookies });
  } catch (error) {
    return errorResponse(error);
  }
}
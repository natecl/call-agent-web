import { verifyCheckoutSession } from '../_lib/checkout.js';
import { errorResponse, json } from '../_lib/http.js';
import { issueAccountSession, readSession } from '../_lib/auth.js';
import { resolveAccount } from '../_lib/stripe_account.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get('session_id');
    if (sessionId) {
      const result = await verifyCheckoutSession(context.env, sessionId);
      const issued = await issueAccountSession(context.env, context.request, {
        email: result.email,
        name: result.name,
        phone: result.phone,
        customerId: result.customerId,
        hasAccount: true,
      });
      return json({ ...result, csrf: issued.csrf }, 200, { cookies: issued.cookies });
    }
    const auth = await readSession(context.env, context.request);
    if (!auth || !auth.email) {
      const err = new Error('Sign in to continue');
      err.status = 401;
      throw err;
    }
    const account = await resolveAccount(context.env, {
      email: auth.email,
      name: auth.name,
      phone: auth.phone,
    });
    if (!account || !account.hasAccount) {
      const err = new Error('No Treena account for this sign-in');
      err.status = 404;
      throw err;
    }
    const issued = await issueAccountSession(context.env, context.request, {
      email: auth.email,
      name: account.name,
      phone: account.phone,
      customerId: account.customerId,
      hasAccount: true,
    });
    return json({ ...account, csrf: issued.csrf || auth.csrf }, 200, { cookies: issued.cookies });
  } catch (error) {
    return errorResponse(error);
  }
}
import { createCheckoutSession } from '../_lib/checkout.js';
import { errorResponse, json, originFrom, readJson } from '../_lib/http.js';

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const result = await createCheckoutSession(context.env, {
      origin: originFrom(context.request),
      planId: body.plan,
      email: body.email,
      name: body.name,
      phone: body.phone,
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

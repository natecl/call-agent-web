import { saveAccountSettings } from '../_lib/checkout.js';
import { errorResponse, json, readJson } from '../_lib/http.js';

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const result = await saveAccountSettings(context.env, {
      email: body.email,
      name: body.name,
      phone: body.phone,
      planId: body.plan,
      retainAfterCall: body.retainAfterCall,
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

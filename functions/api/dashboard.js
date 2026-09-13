import { loadDashboard } from '../_lib/dashboard.js';
import { errorResponse, json } from '../_lib/http.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get('session_id');
    const result = await loadDashboard(context.env, sessionId);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

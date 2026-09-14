export function json(data, status = 200, extra = {}) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };
  const res = new Response(JSON.stringify(data), { status, headers });
  const cookies = extra.cookies || [];
  for (const cookie of cookies) res.headers.append('Set-Cookie', cookie);
  return res;
}

export function errorResponse(error) {
  const status = error && error.status ? error.status : 500;
  const message = error && error.message ? error.message : 'Request failed';
  return json({ error: message }, status);
}

export function originFrom(request) {
  return new URL(request.url).origin;
}

export async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON');
    err.status = 400;
    throw err;
  }
}

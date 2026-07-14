import { validateSession } from '../_auth.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const session = await validateSession(request, env);
    if (!session) {
      // Check if any users exist (for showing register vs login)
      const result = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
      return new Response(JSON.stringify({ authenticated: false, hasUsers: result.count > 0 }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({
      authenticated: true,
      userId: session.userId,
      email: session.email,
      role: session.role,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Auth check failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

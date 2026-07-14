import { validateSession } from './_auth.js';

export async function onRequest(context) {
  const { request, next, data, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip auth for auth endpoints and OPTIONS preflight
  if (path.startsWith('/api/auth/') || request.method === 'OPTIONS') {
    return next();
  }

  // Skip auth for the cron endpoint (uses its own secret)
  if (path.startsWith('/api/cron/')) {
    return next();
  }

  const session = await validateSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  data.user = session;
  return next();
}

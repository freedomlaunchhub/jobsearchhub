import { generateSalt, hashPassword, createSession, setSessionCookie } from '../_auth.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEFAULT_JOB_TITLES = JSON.stringify([
  'Project Manager',
  'Senior Project Manager',
  'Change Manager',
  'Change Management Lead',
  'Transformation Lead',
  'Program Manager',
  'PMO Manager',
  'Organizational Change Manager',
]);

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Only allow registration if no users exist
    const existing = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    if (existing.count > 0) {
      return new Response(JSON.stringify({ error: 'Registration closed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const id = crypto.randomUUID();
    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    const passwordHash = `${salt}:${hash}`;

    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).bind(id, email.toLowerCase(), passwordHash, 'admin').run();

    // Create default settings
    await env.DB.prepare(
      'INSERT INTO settings (user_id, job_titles, location, remote_included, daily_target) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, DEFAULT_JOB_TITLES, 'Calgary, AB, Canada', 1, 5).run();

    const token = await createSession(env, id, email.toLowerCase(), 'admin');
    const isSecure = request.url.startsWith('https');

    return new Response(JSON.stringify({ success: true, userId: id }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setSessionCookie(token, isSecure),
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    console.error('register error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Registration failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

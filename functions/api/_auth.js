const ITERATIONS = 100000;
const KEY_LENGTH = 256;

export function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const saltBytes = new Uint8Array(salt.match(/.{2}/g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(env, userId, email, role) {
  const token = crypto.randomUUID();
  await env.KV.put(`session:${token}`, JSON.stringify({ userId, email, role }), { expirationTtl: 86400 });
  return token;
}

export async function validateSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/job_hub_session=([^;]+)/);
  if (!match) return null;
  const token = match[1];
  const data = await env.KV.get(`session:${token}`, 'json');
  return data;
}

export function setSessionCookie(token, secure) {
  const flags = `HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secure ? '; Secure' : ''}`;
  return `job_hub_session=${token}; ${flags}`;
}

export function clearSessionCookie(secure) {
  const flags = `HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
  return `job_hub_session=; ${flags}`;
}

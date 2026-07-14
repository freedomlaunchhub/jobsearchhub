import { jsonResponse, optionsResponse, deserializeCompany, serializeCompany } from '../_serialize.js';

export async function onRequestGet(context) {
  const { env, data } = context;
  const userId = data.user.userId;

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();
    return jsonResponse(results.map(deserializeCompany));
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const userId = data.user.userId;

  try {
    const company = await request.json();
    const s = serializeCompany(company, userId);

    await env.DB.prepare(
      `INSERT INTO companies (id, user_id, name, industry, website, careers_url, linkedin_url, size, priority, status, why_dream, notes, contact_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(s.id, s.user_id, s.name, s.industry, s.website, s.careers_url, s.linkedin_url, s.size, s.priority, s.status, s.why_dream, s.notes, s.contact_count, s.created_at).run();

    return jsonResponse({ success: true, id: s.id }, 201);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env, data } = context;
  const userId = data.user.userId;

  try {
    const company = await request.json();
    const s = serializeCompany(company, userId);

    await env.DB.prepare(
      `UPDATE companies SET name=?, industry=?, website=?, careers_url=?, linkedin_url=?, size=?, priority=?, status=?, why_dream=?, notes=?, contact_count=?
       WHERE id=? AND user_id=?`
    ).bind(s.name, s.industry, s.website, s.careers_url, s.linkedin_url, s.size, s.priority, s.status, s.why_dream, s.notes, s.contact_count, s.id, userId).run();

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, data } = context;
  const userId = data.user.userId;
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');

  if (!id) return jsonResponse({ error: 'id is required' }, 400);

  try {
    await env.DB.prepare('DELETE FROM companies WHERE id = ? AND user_id = ?').bind(id, userId).run();
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return optionsResponse();
}

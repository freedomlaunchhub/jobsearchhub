import { jsonResponse, optionsResponse, deserializeJob, serializeJob } from '../_serialize.js';

export async function onRequestGet(context) {
  const { env, data } = context;
  const userId = data.user.userId;
  const url = new URL(context.request.url);
  const status = url.searchParams.get('status');
  const id = url.searchParams.get('id');

  try {
    if (id) {
      const row = await env.DB.prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?').bind(id, userId).first();
      return jsonResponse(row ? deserializeJob(row) : null);
    }

    let query = 'SELECT * FROM jobs WHERE user_id = ?';
    const params = [userId];
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse(results.map(deserializeJob));
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const userId = data.user.userId;

  try {
    const jobs = await request.json();
    const jobList = Array.isArray(jobs) ? jobs : [jobs];

    const stmt = env.DB.prepare(
      `INSERT OR IGNORE INTO jobs (id, user_id, title, company, location, remote, source, source_url, posted_date, description, salary_range, requirements, status, status_history, notes, applied_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const batch = jobList.map(job => {
      const s = serializeJob(job, userId);
      return stmt.bind(s.id, s.user_id, s.title, s.company, s.location, s.remote, s.source, s.source_url, s.posted_date, s.description, s.salary_range, s.requirements, s.status, s.status_history, s.notes, s.applied_date, s.created_at);
    });

    await env.DB.batch(batch);
    return jsonResponse({ success: true, count: jobList.length }, 201);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env, data } = context;
  const userId = data.user.userId;

  try {
    const job = await request.json();
    const s = serializeJob(job, userId);

    await env.DB.prepare(
      `UPDATE jobs SET title=?, company=?, location=?, remote=?, source=?, source_url=?, posted_date=?, description=?, salary_range=?, requirements=?, status=?, status_history=?, notes=?, applied_date=?
       WHERE id=? AND user_id=?`
    ).bind(s.title, s.company, s.location, s.remote, s.source, s.source_url, s.posted_date, s.description, s.salary_range, s.requirements, s.status, s.status_history, s.notes, s.applied_date, s.id, userId).run();

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
    await env.DB.prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?').bind(id, userId).run();
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return optionsResponse();
}

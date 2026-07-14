import { jsonResponse, optionsResponse, deserializeDailyLog } from '../_serialize.js';

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function onRequestGet(context) {
  const { env, data } = context;
  const userId = data.user.userId;
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || getTodayDate();

  try {
    let row = await env.DB.prepare(
      'SELECT * FROM daily_logs WHERE user_id = ? AND date = ?'
    ).bind(userId, date).first();

    if (!row) {
      // Auto-create today's log
      await env.DB.prepare(
        'INSERT OR IGNORE INTO daily_logs (user_id, date) VALUES (?, ?)'
      ).bind(userId, date).run();
      row = await env.DB.prepare(
        'SELECT * FROM daily_logs WHERE user_id = ? AND date = ?'
      ).bind(userId, date).first();
    }

    return jsonResponse(row ? deserializeDailyLog(row) : null);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env, data } = context;
  const userId = data.user.userId;

  try {
    const body = await request.json();

    // Increment a specific field
    if (body.incrementField) {
      const fieldMap = {
        applicationsCount: 'applications_count',
        connectionsSent: 'connections_sent',
        followupsDone: 'followups_done',
        jobsReviewed: 'jobs_reviewed',
      };
      const col = fieldMap[body.incrementField];
      if (!col) return jsonResponse({ error: 'Invalid field' }, 400);

      const date = body.date || getTodayDate();
      await env.DB.prepare(
        'INSERT OR IGNORE INTO daily_logs (user_id, date) VALUES (?, ?)'
      ).bind(userId, date).run();
      await env.DB.prepare(
        `UPDATE daily_logs SET ${col} = ${col} + 1 WHERE user_id = ? AND date = ?`
      ).bind(userId, date).run();

      const row = await env.DB.prepare(
        'SELECT * FROM daily_logs WHERE user_id = ? AND date = ?'
      ).bind(userId, date).first();

      return jsonResponse(row ? deserializeDailyLog(row) : null);
    }

    // Full update
    const date = body.date || getTodayDate();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO daily_logs (user_id, date, applications_count, connections_sent, followups_done, jobs_reviewed, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, date, body.applicationsCount || 0, body.connectionsSent || 0, body.followupsDone || 0, body.jobsReviewed || 0, body.notes || '').run();

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return optionsResponse();
}

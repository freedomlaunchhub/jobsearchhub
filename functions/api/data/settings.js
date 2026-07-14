import { jsonResponse, optionsResponse, deserializeSettings } from '../_serialize.js';

export async function onRequestGet(context) {
  const { env, data } = context;
  const userId = data.user.userId;

  try {
    let row = await env.DB.prepare(
      'SELECT * FROM settings WHERE user_id = ?'
    ).bind(userId).first();

    if (!row) {
      await env.DB.prepare(
        'INSERT INTO settings (user_id) VALUES (?)'
      ).bind(userId).run();
      row = await env.DB.prepare(
        'SELECT * FROM settings WHERE user_id = ?'
      ).bind(userId).first();
    }

    return jsonResponse(row ? deserializeSettings(row) : null);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env, data } = context;
  const userId = data.user.userId;

  try {
    const body = await request.json();

    await env.DB.prepare(
      `INSERT OR REPLACE INTO settings (user_id, job_titles, location, remote_included, job_sources, daily_target, streak_current, streak_longest, last_active_date, bright_data_api_key, anthropic_api_key, preferred_industries, preferred_company_sizes, last_daily_refresh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?)`
    ).bind(
      userId,
      JSON.stringify(body.jobTitles || []),
      body.location || '',
      body.remoteIncluded ? 1 : 0,
      JSON.stringify(body.jobSources || []),
      body.dailyTarget || 5,
      body.streak?.current || 0,
      body.streak?.longest || 0,
      body.streak?.lastActiveDate || '',
      JSON.stringify(body.preferredIndustries || []),
      JSON.stringify(body.preferredCompanySizes || []),
      body.lastDailyRefresh || ''
    ).run();

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return optionsResponse();
}

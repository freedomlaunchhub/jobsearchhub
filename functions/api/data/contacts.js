import { jsonResponse, optionsResponse, deserializeContact, serializeContact } from '../_serialize.js';

export async function onRequestGet(context) {
  const { env, data } = context;
  const userId = data.user.userId;
  const url = new URL(context.request.url);
  const companyId = url.searchParams.get('companyId');
  const overdue = url.searchParams.get('overdue');

  try {
    if (overdue === 'true') {
      const today = new Date().toISOString().split('T')[0];
      const { results } = await env.DB.prepare(
        'SELECT * FROM contacts WHERE user_id = ? AND next_followup_date IS NOT NULL AND next_followup_date <= ? ORDER BY next_followup_date ASC'
      ).bind(userId, today).all();
      return jsonResponse(results.map(deserializeContact));
    }

    let query = 'SELECT * FROM contacts WHERE user_id = ?';
    const params = [userId];
    if (companyId) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }
    query += ' ORDER BY created_at DESC';

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse(results.map(deserializeContact));
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const userId = data.user.userId;

  try {
    const contact = await request.json();
    const s = serializeContact(contact, userId);

    await env.DB.prepare(
      `INSERT INTO contacts (id, user_id, company_id, company_name, name, title, linkedin_url, location, other_social, rapport_notes, connection_status, connection_date, last_contact_date, next_followup_date, message_drafts, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(s.id, s.user_id, s.company_id, s.company_name, s.name, s.title, s.linkedin_url, s.location, s.other_social, s.rapport_notes, s.connection_status, s.connection_date, s.last_contact_date, s.next_followup_date, s.message_drafts, s.notes, s.created_at).run();

    // Increment company contact count
    if (s.company_id) {
      await env.DB.prepare(
        'UPDATE companies SET contact_count = contact_count + 1 WHERE id = ? AND user_id = ?'
      ).bind(s.company_id, userId).run();
    }

    return jsonResponse({ success: true, id: s.id }, 201);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env, data } = context;
  const userId = data.user.userId;

  try {
    const contact = await request.json();
    const s = serializeContact(contact, userId);

    await env.DB.prepare(
      `UPDATE contacts SET company_id=?, company_name=?, name=?, title=?, linkedin_url=?, location=?, other_social=?, rapport_notes=?, connection_status=?, connection_date=?, last_contact_date=?, next_followup_date=?, message_drafts=?, notes=?
       WHERE id=? AND user_id=?`
    ).bind(s.company_id, s.company_name, s.name, s.title, s.linkedin_url, s.location, s.other_social, s.rapport_notes, s.connection_status, s.connection_date, s.last_contact_date, s.next_followup_date, s.message_drafts, s.notes, s.id, userId).run();

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
    // Get contact to find company_id for decrementing count
    const contact = await env.DB.prepare('SELECT company_id FROM contacts WHERE id = ? AND user_id = ?').bind(id, userId).first();

    await env.DB.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').bind(id, userId).run();

    if (contact && contact.company_id) {
      await env.DB.prepare(
        'UPDATE companies SET contact_count = MAX(0, contact_count - 1) WHERE id = ? AND user_id = ?'
      ).bind(contact.company_id, userId).run();
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return optionsResponse();
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

const PEOPLE_DATASET_ID = 'gd_l1viktl72bvl7bjuj0';

const DEFAULT_TARGET_ROLES = [
  'Senior Manager',
  'Director',
  'Project Manager',
  'Program Manager',
  'Recruiter',
  'Talent Acquisition',
];

export async function onRequestPost(context) {
  const { request, env, data } = context;

  try {
    const body = await request.json();
    const {
      companyName,
      companyId,
      targetRoles = DEFAULT_TARGET_ROLES,
      autoSave = true,
    } = body;
    const brightDataApiKey = env.BRIGHT_DATA_API_KEY;
    const userId = data.user?.userId;

    if (!companyName) {
      return jsonResponse({ error: 'companyName is required' }, 400);
    }
    if (!brightDataApiKey) {
      return jsonResponse({ error: 'Bright Data API key not configured on server' }, 500);
    }

    const searchBody = {
      filter: {
        operator: 'and',
        filters: [
          { name: 'current_company_name', value: companyName, operator: 'contains' },
        ],
      },
      limit: 10,
    };

    const response = await fetch(
      `https://api.brightdata.com/datasets/search/${PEOPLE_DATASET_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${brightDataApiKey}`,
        },
        body: JSON.stringify(searchBody),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return jsonResponse({ error: `Bright Data error (${response.status}): ${text}` }, 502);
    }

    const results = await response.json();
    const items = Array.isArray(results) ? results : (results.results || []);

    const roleLower = targetRoles.map((r) => r.toLowerCase());
    const scored = items.map((person) => {
      const position = (person.position || person.title || '').toLowerCase();
      const roleMatch = roleLower.some((r) => position.includes(r));
      return { person, roleMatch };
    });
    scored.sort((a, b) => (b.roleMatch ? 1 : 0) - (a.roleMatch ? 1 : 0));

    const seen = new Set();
    const contacts = [];
    for (const { person } of scored) {
      const linkedinUrl = person.url || person.linkedin_url || '';
      const name = person.name || person.full_name || '';
      if (!name) continue;
      const key = linkedinUrl ? linkedinUrl.toLowerCase().replace(/\/+$/, '') : name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push({
        name,
        title: person.position || person.title || '',
        linkedinUrl,
        city: person.city || '',
        about: person.about || '',
      });
      if (contacts.length >= 10) break;
    }

    let savedCount = 0;
    if (autoSave && userId && companyId && contacts.length > 0) {
      for (const contact of contacts) {
        const existingLinkedin = contact.linkedinUrl
          ? await env.DB.prepare(
              'SELECT id FROM contacts WHERE user_id = ? AND linkedin_url = ?'
            ).bind(userId, contact.linkedinUrl).first()
          : null;
        if (existingLinkedin) continue;

        const existingName = await env.DB.prepare(
          'SELECT id FROM contacts WHERE user_id = ? AND company_id = ? AND LOWER(name) = LOWER(?)'
        ).bind(userId, companyId, contact.name).first();
        if (existingName) continue;

        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO contacts (id, user_id, company_id, company_name, name, title, linkedin_url, other_social, rapport_notes, connection_status, connection_date, last_contact_date, next_followup_date, message_drafts, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, 'identified', NULL, NULL, NULL, '[]', '', ?)`
        ).bind(
          id, userId, companyId, companyName,
          contact.name, contact.title, contact.linkedinUrl,
          contact.about,
          new Date().toISOString()
        ).run();
        savedCount++;
      }

      if (savedCount > 0) {
        await env.DB.prepare(
          'UPDATE companies SET contact_count = (SELECT COUNT(*) FROM contacts WHERE company_id = ? AND user_id = ?) WHERE id = ? AND user_id = ?'
        ).bind(companyId, userId, companyId, userId).run();
      }
    }

    return jsonResponse({
      contacts,
      companyName,
      savedCount,
      searchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('find-contacts error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

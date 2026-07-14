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
  'Director',
  'VP',
  'Vice President',
  'Head of',
  'Senior Manager',
  'Manager',
  'Project Manager',
  'Program Manager',
  'Change Manager',
  'Transformation',
  'PMO',
  'Scrum Master',
  'Agile',
  'Recruiter',
  'Talent Acquisition',
  'People',
  'HR',
  'Hiring',
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

    // Pull user's job titles from settings to build context-aware role matching
    let userJobTitles = [];
    if (userId) {
      const settingsRow = await env.DB.prepare(
        'SELECT job_titles FROM settings WHERE user_id = ?'
      ).bind(userId).first();
      if (settingsRow?.job_titles) {
        try {
          userJobTitles = JSON.parse(settingsRow.job_titles);
        } catch {}
      }
    }

    const searchBody = {
      filter: {
        operator: 'and',
        filters: [
          { name: 'current_company_name', value: companyName, operator: 'includes' },
        ],
      },
      size: 25,
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
    const items = results.hits || [];

    const allRoles = [...targetRoles];
    for (const jt of userJobTitles) {
      if (!allRoles.some((r) => r.toLowerCase() === jt.toLowerCase())) {
        allRoles.push(jt);
      }
    }
    const roleLower = allRoles.map((r) => r.toLowerCase());

    // Seniority keywords for scoring — hiring managers and leaders score highest
    const seniorityKeywords = ['director', 'vp', 'vice president', 'head of', 'chief', 'senior director', 'svp', 'evp'];
    const recruiterKeywords = ['recruiter', 'talent acquisition', 'hiring', 'people operations', 'hr business partner'];

    const scored = items.map((person) => {
      const position = (person.position || person.title || '').toLowerCase();
      let score = 0;

      // Role relevance: matches user's target roles or job titles
      const roleMatch = roleLower.some((r) => position.includes(r));
      if (roleMatch) score += 3;

      // Senior/leadership bonus — these are decision-makers
      if (seniorityKeywords.some((k) => position.includes(k))) score += 2;

      // Recruiter bonus — gatekeepers
      if (recruiterKeywords.some((k) => position.includes(k))) score += 2;

      // Peer-level bonus — same function, good for referrals
      for (const jt of userJobTitles) {
        if (position.includes(jt.toLowerCase())) {
          score += 1;
          break;
        }
      }

      return { person, score };
    });
    scored.sort((a, b) => b.score - a.score);

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

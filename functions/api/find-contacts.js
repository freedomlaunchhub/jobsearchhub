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

// Role groups (highest priority first). Only people matching one of these —
// or the user's own target job titles (peers) — are kept.
const ROLE_GROUPS = [
  { score: 4, keywords: ['senior manager', 'director', 'head', 'vp', 'vice president'] },   // hiring managers
  { score: 3, keywords: ['project manager', 'program manager', 'business analyst'] },       // relevant professionals
  { score: 2, keywords: ['recruiter', 'talent acquisition', 'talent partner'] },            // recruiters
];

export function scoreContactRole(position, peerTitles) {
  const p = position.toLowerCase();
  for (const group of ROLE_GROUPS) {
    if (group.keywords.some((k) => p.includes(k))) return group.score;
  }
  // Optional peers: people currently doing the user's target job
  if (peerTitles.some((t) => t && p.includes(t.toLowerCase()))) return 1;
  return 0;
}

export async function onRequestPost(context) {
  const { request, env, data } = context;

  try {
    const body = await request.json();
    const {
      companyName,
      companyId,
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

    // 422 means the filter matched zero records — a valid empty result
    if (response.status === 422) {
      return jsonResponse({ contacts: [], companyName, savedCount: 0, searchedAt: new Date().toISOString() });
    }

    if (!response.ok) {
      const text = await response.text();
      return jsonResponse({ error: `Bright Data error (${response.status}): ${text}` }, 502);
    }

    const results = await response.json();
    let items = results.hits || [];

    // 'includes' does substring matching, which also returns freelancers and
    // agencies with the company name in their title (e.g. "Shopify Store
    // designer"). Prefer people whose current company is an exact match;
    // only fall back to the loose matches when no exact ones exist.
    const companyLower = companyName.trim().toLowerCase();
    const exactMatches = items.filter(
      (p) => (p.current_company_name || p.current_company?.name || '').trim().toLowerCase() === companyLower
    );
    if (exactMatches.length > 0) {
      items = exactMatches;
    }

    // Keep ONLY people matching the role criteria (hiring managers, relevant
    // professionals, recruiters, or peers in the user's target roles) —
    // everyone else is discarded, not just ranked lower.
    const scored = items
      .map((person) => ({
        person,
        score: scoreContactRole(person.position || person.title || '', userJobTitles),
      }))
      .filter(({ score }) => score > 0);
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
        location: person.city || person.location || '',
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
          `INSERT INTO contacts (id, user_id, company_id, company_name, name, title, linkedin_url, location, other_social, rapport_notes, connection_status, connection_date, last_contact_date, next_followup_date, message_drafts, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '', 'identified', NULL, NULL, NULL, '[]', '', ?)`
        ).bind(
          id, userId, companyId, companyName,
          contact.name, contact.title, contact.linkedinUrl,
          contact.location,
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

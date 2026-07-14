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

export const ROLE_KEYWORDS = ROLE_GROUPS.flatMap((g) => g.keywords);

// Each phrase in an array-valued 'includes' makes the search more expensive;
// past ~a dozen phrases Bright Data starts timing out. Add the user's target
// titles (peers) only when not already covered, and cap the total.
export function buildRoleKeywords(userJobTitles) {
  const keywords = [...ROLE_KEYWORDS];
  for (const t of userJobTitles || []) {
    const tl = String(t).toLowerCase().trim();
    if (!tl) continue;
    if (keywords.some((k) => tl.includes(k) || k.includes(tl))) continue;
    keywords.push(tl);
    if (keywords.length >= 13) break;
  }
  return keywords;
}

export function scoreContactRole(position, peerTitles) {
  const p = position.toLowerCase();
  for (const group of ROLE_GROUPS) {
    if (group.keywords.some((k) => p.includes(k))) return group.score;
  }
  // Optional peers: people currently doing the user's target job
  if (peerTitles.some((t) => t && p.includes(t.toLowerCase()))) return 1;
  return 0;
}

// Titles matching these are noise for job-search networking regardless of
// seniority keywords: they recruit customers/students (not employees) or
// work in functions that don't hire for the user's target roles.
const NEGATIVE_KEYWORDS = [
  'student recruit', 'international recruit', 'admission', 'enrollment', 'enrolment',
  'sales', 'account manag', 'account executive', 'account support', 'customer',
  'client relations', 'business development', 'marketing',
];

export function isExcludedTitle(title) {
  const t = title.toLowerCase();
  return NEGATIVE_KEYWORDS.some((k) => t.includes(k));
}

// Final screen: after the deterministic filters (country, current-title role
// match, exclusion list) have narrowed candidates to a handful, one cheap
// model call judges the ambiguous cases keyword rules can't ("Recruitment
// Manager" at an edtech = student recruitment, not talent acquisition).
// Returns booleans aligned with candidates, or null when unavailable — the
// caller then keeps everyone rather than failing.
export async function aiRelevanceScreen(candidates, userJobTitles, anthropicApiKey) {
  if (!anthropicApiKey || candidates.length === 0) return null;

  const list = candidates.map((c, i) => `${i}. ${c.title}`).join('\n');
  const prompt = `You are screening employees at one company as networking targets for a job seeker.

KEEP a person ONLY if their job title clearly indicates one of:
1. Hiring manager / leadership: Senior Manager, Director, Head of a function, VP / Vice President
2. Relevant professional: Project Manager, Program Manager, Business Analyst
3. TALENT recruiter: internal Recruiter, Talent Acquisition, Talent Partner — recruits EMPLOYEES for the company
4. Peer: works as one of: ${(userJobTitles || []).join(', ') || '(none listed)'}

DISCARD:
- Roles recruiting customers or students (student recruitment, international recruitment, admissions, enrollment)
- Sales, account management, customer success/relations, business development, marketing
- Junior staff, specialists, coordinators, associates, interns
- Ambiguous titles — when in doubt, discard

Job titles:
${list}

Reply with ONLY a JSON array of the numbers to KEEP, e.g. [0,3,7]. Reply [] if none qualify.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\[[\d,\s]*\]/);
    if (!match) return null;
    const keep = new Set(JSON.parse(match[0]));
    return candidates.map((_, i) => keep.has(i));
  } catch {
    return null;
  }
}

// The dataset's `position` field is the profile HEADLINE — free-form marketing
// text ("Recruiter | US IT | Canada PR..."). The experience section carries the
// person's actual current job title at the company; prefer it for matching.
export function currentTitleAt(person, companyName) {
  const companyLower = companyName.trim().toLowerCase();
  for (const exp of person.experience || []) {
    const expCompany = (exp.company || '').trim().toLowerCase();
    if (expCompany && expCompany !== companyLower) continue;
    // Grouped roles at one company nest under `positions`, newest first
    if (Array.isArray(exp.positions) && exp.positions.length > 0) {
      const current = exp.positions.find((p) => p.end_date === 'Present') || exp.positions[0];
      if (current?.title) return current.title;
    }
    if (exp.title && (exp.end_date === 'Present' || !exp.end_date || expCompany === companyLower)) {
      return exp.title;
    }
  }
  return person.position || person.title || '';
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

    // Pull user's job titles (peer matching) and discovery country from settings
    let userJobTitles = [];
    let country = '';
    if (userId) {
      const settingsRow = await env.DB.prepare(
        'SELECT job_titles, discovery_country FROM settings WHERE user_id = ?'
      ).bind(userId).first();
      if (settingsRow?.job_titles) {
        try {
          userJobTitles = JSON.parse(settingsRow.job_titles);
        } catch {}
      }
      country = settingsRow?.discovery_country || '';
    }

    // Role keywords go INTO the query (array 'includes' = match any), so the
    // search scans everyone at the company for matching titles instead of
    // filtering an arbitrary 25-person sample afterwards.
    const baseFilters = [
      { name: 'current_company_name', value: companyName, operator: 'includes' },
    ];
    if (country) {
      baseFilters.push({ name: 'country_code', operator: '=', value: country });
    }

    const roleFilteredBody = {
      filter: {
        operator: 'and',
        filters: [
          ...baseFilters,
          { name: 'position', operator: 'includes', value: buildRoleKeywords(userJobTitles) },
        ],
      },
      size: 25,
    };
    // Fallback when the role-filtered query times out on Bright Data's side:
    // sample the company without the position filter and filter locally.
    const companyOnlyBody = {
      filter: baseFilters.length === 1 ? baseFilters[0] : { operator: 'and', filters: baseFilters },
      size: 25,
    };

    const search = (body) =>
      fetch(`https://api.brightdata.com/datasets/search/${PEOPLE_DATASET_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${brightDataApiKey}`,
        },
        body: JSON.stringify(body),
      });

    let response = await search(roleFilteredBody);
    if (!response.ok && response.status !== 422) {
      // The multi-phrase search can be slow; one retry usually hits warm caches
      await new Promise((r) => setTimeout(r, 2000));
      response = await search(roleFilteredBody);
    }
    if (!response.ok && response.status !== 422) {
      response = await search(companyOnlyBody);
    }

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

    // Judge each person by their actual current job title at the company (the
    // headline the query matched on is free-form text and full of noise).
    // Titles in excluded functions (student recruitment, sales, admissions...)
    // are dropped no matter what keywords they contain.
    const scored = items
      .map((person) => {
        const cleanTitle = currentTitleAt(person, companyName);
        return {
          person,
          cleanTitle,
          score: isExcludedTitle(cleanTitle) ? 0 : scoreContactRole(cleanTitle, userJobTitles),
        };
      })
      .filter(({ score }) => score > 0);
    scored.sort((a, b) => b.score - a.score);

    const seen = new Set();
    let contacts = [];
    for (const { person, cleanTitle } of scored) {
      const linkedinUrl = person.url || person.linkedin_url || '';
      const name = person.name || person.full_name || '';
      if (!name) continue;
      const key = linkedinUrl ? linkedinUrl.toLowerCase().replace(/\/+$/, '') : name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push({
        name,
        title: cleanTitle,
        linkedinUrl,
        location: person.city || person.location || '',
      });
    }

    // Final AI pass over the already-narrowed list (one cheap call); on
    // failure keep the deterministic result rather than erroring
    const verdicts = await aiRelevanceScreen(contacts, userJobTitles, env.ANTHROPIC_API_KEY);
    if (verdicts) {
      contacts = contacts.filter((_, i) => verdicts[i]);
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

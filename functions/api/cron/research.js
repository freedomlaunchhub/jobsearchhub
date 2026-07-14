import { scoreContactRole, ROLE_KEYWORDS } from '../find-contacts.js';

const COMPANY_DATASET_ID = 'gd_l1vikfnt1wgvvqz95w';
const PEOPLE_DATASET_ID = 'gd_l1viktl72bvl7bjuj0';

// Companies processed per invocation. The nightly scheduler calls this
// endpoint repeatedly until `remaining` hits 0, so the overall run is
// uncapped — the batch size only keeps each invocation inside Cloudflare's
// per-request subrequest limit.
const BATCH_SIZE = 10;

async function searchDataset(datasetId, filter, size, apiKey) {
  const response = await fetch(`https://api.brightdata.com/datasets/search/${datasetId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ size, filter }),
  });
  if (response.status === 422) return []; // zero matches
  if (!response.ok) return null;
  const results = await response.json();
  return results.hits || [];
}

// Nightly pickup for the on-demand research queue: processes every company
// the user has switched to 'queued' — research + find contacts — batch by
// batch until the queue is empty.
export async function onRequestPost(context) {
  const { request, env } = context;

  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), { status: 500 });
  }
  if (request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const brightDataApiKey = env.BRIGHT_DATA_API_KEY;
  if (!brightDataApiKey) {
    return new Response(JSON.stringify({ error: 'BRIGHT_DATA_API_KEY not configured' }), { status: 500 });
  }

  try {
    const { results: queued } = await env.DB.prepare(
      "SELECT * FROM companies WHERE status = 'queued' ORDER BY created_at LIMIT ?"
    ).bind(BATCH_SIZE).all();

    let processed = 0;
    const jobTitlesByUser = new Map();

    for (const company of queued) {
      const userId = company.user_id;

      if (!jobTitlesByUser.has(userId)) {
        const settingsRow = await env.DB.prepare(
          'SELECT job_titles FROM settings WHERE user_id = ?'
        ).bind(userId).first();
        let titles = [];
        try { titles = JSON.parse(settingsRow?.job_titles || '[]'); } catch {}
        jobTitlesByUser.set(userId, titles);
      }
      const userJobTitles = jobTitlesByUser.get(userId);
      try {
        // Research: enrich empty fields from the company dataset
        const companyHits = await searchDataset(
          COMPANY_DATASET_ID,
          { name: 'name', operator: 'includes', value: company.name },
          3,
          brightDataApiKey
        );

        if (companyHits && companyHits.length > 0) {
          const exact = companyHits.find((c) => (c.name || '').toLowerCase() === company.name.toLowerCase());
          const c = exact || companyHits[0];
          const industry = Array.isArray(c.industries) ? c.industries.join(', ') : (c.industries || c.industry || '');
          await env.DB.prepare(
            `UPDATE companies SET
              industry = CASE WHEN industry = '' THEN ? ELSE industry END,
              website = CASE WHEN website = '' THEN ? ELSE website END,
              linkedin_url = CASE WHEN linkedin_url = '' THEN ? ELSE linkedin_url END,
              size = CASE WHEN size = '' THEN ? ELSE size END,
              notes = CASE WHEN notes = '' THEN ? ELSE notes END
            WHERE id = ? AND user_id = ?`
          ).bind(
            industry,
            c.website || '',
            c.url || c.linkedin_url || '',
            c.company_size || c.size || '',
            c.about || '',
            company.id, userId
          ).run();
        }

        // Find contacts: exact company-name matches preferred over loose
        // substring hits (freelancers/agencies)
        // Role keywords go into the query so the search scans everyone at
        // the company for matching titles, not an arbitrary sample
        const peopleHits = await searchDataset(
          PEOPLE_DATASET_ID,
          {
            operator: 'and',
            filters: [
              { name: 'current_company_name', operator: 'includes', value: company.name },
              { name: 'position', operator: 'includes', value: [...ROLE_KEYWORDS, ...userJobTitles.filter(Boolean)] },
            ],
          },
          25,
          brightDataApiKey
        );

        if (peopleHits && peopleHits.length > 0) {
          const companyLower = company.name.trim().toLowerCase();
          const exactPeople = peopleHits.filter(
            (p) => (p.current_company_name || p.current_company?.name || '').trim().toLowerCase() === companyLower
          );
          // Query already restricted to role criteria; the score just orders
          // (hiring managers first, peers last)
          const people = (exactPeople.length > 0 ? exactPeople : peopleHits)
            .map((p) => ({ p, score: scoreContactRole(p.position || p.title || '', userJobTitles) }))
            .sort((a, b) => b.score - a.score)
            .map(({ p }) => p);

          let contactsSaved = 0;
          for (const person of people) {
            const name = person.name || person.full_name || '';
            if (!name) continue;

            const linkedinUrl = person.url || person.linkedin_url || '';
            if (linkedinUrl) {
              const existing = await env.DB.prepare(
                'SELECT id FROM contacts WHERE user_id = ? AND linkedin_url = ?'
              ).bind(userId, linkedinUrl).first();
              if (existing) continue;
            }
            const existingName = await env.DB.prepare(
              'SELECT id FROM contacts WHERE user_id = ? AND company_id = ? AND LOWER(name) = LOWER(?)'
            ).bind(userId, company.id, name).first();
            if (existingName) continue;

            await env.DB.prepare(
              `INSERT INTO contacts (id, user_id, company_id, company_name, name, title, linkedin_url, location, other_social, rapport_notes, connection_status, message_drafts, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '', 'identified', '[]', '', ?)`
            ).bind(
              crypto.randomUUID(), userId, company.id, company.name,
              name, person.position || person.title || '', linkedinUrl,
              person.city || person.location || '',
              new Date().toISOString()
            ).run();
            contactsSaved++;
          }

          if (contactsSaved > 0) {
            await env.DB.prepare(
              'UPDATE companies SET contact_count = (SELECT COUNT(*) FROM contacts WHERE company_id = ? AND user_id = ?) WHERE id = ? AND user_id = ?'
            ).bind(company.id, userId, company.id, userId).run();
          }
        }

        await env.DB.prepare(
          "UPDATE companies SET status = 'researched' WHERE id = ? AND user_id = ?"
        ).bind(company.id, userId).run();
        processed++;
      } catch (companyErr) {
        // Mark as researched anyway so a persistently failing company can't
        // wedge the queue; details stay empty for a manual retry
        console.error(`Research failed for ${company.name}:`, companyErr);
        await env.DB.prepare(
          "UPDATE companies SET status = 'researched' WHERE id = ? AND user_id = ?"
        ).bind(company.id, userId).run();
      }
    }

    const { count } = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM companies WHERE status = 'queued'"
    ).first();

    return new Response(JSON.stringify({ processed, remaining: count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

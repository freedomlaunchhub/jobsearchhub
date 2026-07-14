function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapLinkedInJob(raw, userId) {
  const baseSalary = raw.base_salary || null;
  let salaryRange = null;
  if (baseSalary && baseSalary.min_amount != null) {
    const currency = baseSalary.currency || '$';
    const min = baseSalary.min_amount;
    const max = baseSalary.max_amount;
    const period = baseSalary.payment_period || '';
    salaryRange = max ? `${currency}${min}-${currency}${max}/${period}` : `${currency}${min}/${period}`;
  } else if (raw.job_base_pay_range) {
    salaryRange = raw.job_base_pay_range;
  }

  return {
    id: raw.job_posting_id || crypto.randomUUID(),
    user_id: userId,
    title: raw.job_title || '',
    company: raw.company_name || '',
    location: raw.job_location || '',
    remote: (raw.job_location || '').toLowerCase().includes('remote') ? 1 : 0,
    source: 'linkedin',
    source_url: raw.url || raw.apply_link || '',
    posted_date: raw.job_posted_date || new Date().toISOString().split('T')[0],
    description: raw.job_summary || raw.job_description_formatted || '',
    salary_range: salaryRange,
    requirements: '[]',
    status: 'new',
    status_history: JSON.stringify([{ status: 'new', date: new Date().toISOString() }]),
    notes: '',
    applied_date: null,
    created_at: new Date().toISOString(),
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), { status: 500 });
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const brightDataApiKey = env.BRIGHT_DATA_API_KEY;
  if (!brightDataApiKey) {
    return new Response(JSON.stringify({ error: 'BRIGHT_DATA_API_KEY not configured' }), { status: 500 });
  }

  try {
    const { results: users } = await env.DB.prepare('SELECT id FROM users').all();
    const summary = [];

    for (const user of users) {
      const userId = user.id;
      const settings = await env.DB.prepare('SELECT * FROM settings WHERE user_id = ?').bind(userId).first();

      if (!settings) continue;

      const jobTitles = JSON.parse(settings.job_titles || '[]');
      if (jobTitles.length === 0) continue;

      const location = settings.location || 'Calgary, AB, Canada';

      const inputs = jobTitles.map((title) => ({
        keyword: title,
        location,
        country: 'CA',
        time_range: 'Past 24 hours',
        selective_search: true,
        remote: settings.remote_included ? 'Remote' : undefined,
      }));

      const triggerUrl = 'https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lpfll7v5hcqtkxl6l&format=json&type=discover_new&discover_by=keyword';
      const triggerResponse = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${brightDataApiKey}`,
        },
        body: JSON.stringify({ input: inputs }),
      });

      if (!triggerResponse.ok) {
        summary.push({ userId, error: `Trigger failed: ${triggerResponse.status}` });
        continue;
      }

      const triggerData = await triggerResponse.json();
      const snapshotId = triggerData.snapshot_id;
      if (!snapshotId) {
        summary.push({ userId, error: 'No snapshot_id returned' });
        continue;
      }

      let rawJobs = [];
      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await delay(3000);

        const progressResponse = await fetch(
          `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
          { headers: { Authorization: `Bearer ${brightDataApiKey}` } }
        );

        if (!progressResponse.ok) continue;

        const progressData = await progressResponse.json();
        if (progressData.status === 'ready') {
          const snapshotResponse = await fetch(
            `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
            { headers: { Authorization: `Bearer ${brightDataApiKey}` } }
          );
          if (snapshotResponse.ok) {
            const data = await snapshotResponse.json();
            rawJobs = Array.isArray(data) ? data : [];
          }
          break;
        }
        if (progressData.status === 'failed') break;
      }

      const mappedJobs = rawJobs
        .map((j) => mapLinkedInJob(j, userId))
        .filter((j) => j.title && j.company);

      if (mappedJobs.length > 0) {
        const stmt = env.DB.prepare(
          `INSERT OR IGNORE INTO jobs (id, user_id, title, company, location, remote, source, source_url, posted_date, description, salary_range, requirements, status, status_history, notes, applied_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const batch = mappedJobs.map((j) =>
          stmt.bind(j.id, j.user_id, j.title, j.company, j.location, j.remote, j.source, j.source_url, j.posted_date, j.description, j.salary_range, j.requirements, j.status, j.status_history, j.notes, j.applied_date, j.created_at)
        );
        await env.DB.batch(batch);
      }

      // Auto-create companies from new jobs with 'open_listing' status
      if (mappedJobs.length > 0) {
        const { results: existingCompanies } = await env.DB.prepare(
          'SELECT LOWER(name) as name FROM companies WHERE user_id = ?'
        ).bind(userId).all();
        const existingNames = new Set(existingCompanies.map((r) => r.name));

        const newCompanyNames = [...new Set(mappedJobs.map((j) => j.company))]
          .filter((name) => name && !existingNames.has(name.toLowerCase()));

        for (const name of newCompanyNames) {
          await env.DB.prepare(
            `INSERT INTO companies (id, user_id, name, industry, website, careers_url, linkedin_url, size, priority, status, why_dream, notes, contact_count, created_at)
             VALUES (?, ?, ?, '', '', '', '', '', 'medium', 'open_listing', '', '', 0, ?)`
          ).bind(crypto.randomUUID(), userId, name, new Date().toISOString()).run();
        }
      }

      // Phase 2: Research companies with 'new' status
      const { results: newCompanies } = await env.DB.prepare(
        "SELECT * FROM companies WHERE user_id = ? AND status = 'new'"
      ).bind(userId).all();

      let researchedCount = 0;
      for (const company of newCompanies) {
        try {
          const searchBody = {
            filter: {
              operator: 'and',
              filters: [
                { name: 'name', value: company.name, operator: 'includes' },
              ],
            },
            size: 3,
          };

          const researchResponse = await fetch(
            `https://api.brightdata.com/datasets/search/gd_l1vikfnt1wgvvqz95w`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${brightDataApiKey}`,
              },
              body: JSON.stringify(searchBody),
            }
          );

          if (researchResponse.ok) {
            const researchResults = await researchResponse.json();
            const items = researchResults.hits || [];

            if (items.length > 0) {
              const c = items[0];
              const industry = Array.isArray(c.industries) ? c.industries.join(', ') : (c.industry || '');
              await env.DB.prepare(
                `UPDATE companies SET
                  industry = CASE WHEN industry = '' THEN ? ELSE industry END,
                  website = CASE WHEN website = '' THEN ? ELSE website END,
                  linkedin_url = CASE WHEN linkedin_url = '' THEN ? ELSE linkedin_url END,
                  size = CASE WHEN size = '' THEN ? ELSE size END,
                  notes = CASE WHEN notes = '' THEN ? ELSE notes END,
                  status = 'researched'
                WHERE id = ? AND user_id = ?`
              ).bind(
                industry,
                c.website || '',
                c.url || c.linkedin_url || '',
                c.company_size || c.size || '',
                c.about || c.description || '',
                company.id, userId
              ).run();
            } else {
              await env.DB.prepare(
                "UPDATE companies SET status = 'researched' WHERE id = ? AND user_id = ?"
              ).bind(company.id, userId).run();
            }
            researchedCount++;
          }

          // Find contacts for this company
          const peopleBody = {
            filter: {
              operator: 'and',
              filters: [
                { name: 'current_company_name', value: company.name, operator: 'includes' },
              ],
            },
            size: 25,
          };

          const peopleResponse = await fetch(
            `https://api.brightdata.com/datasets/search/gd_l1viktl72bvl7bjuj0`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${brightDataApiKey}`,
              },
              body: JSON.stringify(peopleBody),
            }
          );

          if (peopleResponse.ok) {
            const peopleResults = await peopleResponse.json();
            const people = peopleResults.hits || [];

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
                `INSERT INTO contacts (id, user_id, company_id, company_name, name, title, linkedin_url, other_social, rapport_notes, connection_status, message_drafts, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, 'identified', '[]', '', ?)`
              ).bind(
                crypto.randomUUID(), userId, company.id, company.name,
                name, person.position || person.title || '', linkedinUrl,
                person.about || '',
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

          await delay(500);
        } catch {
          // Continue on individual company research failures
        }
      }

      const today = new Date().toISOString().split('T')[0];
      await env.DB.prepare(
        'UPDATE settings SET last_daily_refresh = ? WHERE user_id = ?'
      ).bind(today, userId).run();

      summary.push({ userId, newJobs: mappedJobs.length, companiesResearched: researchedCount });
    }

    return new Response(JSON.stringify({ success: true, summary }), {
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// job_summary arrives as one flattened paragraph; the formatted (HTML) field
// keeps structure — convert it to plain text with line breaks and bullets
function descriptionText(raw) {
  const html = raw.job_description_formatted;
  if (typeof html === 'string' && html.trim()) {
    return html
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)[^>]*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&(#39|apos);/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return raw.job_summary || '';
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
    description: descriptionText(raw),
    salary_range: salaryRange,
    requirements: '[]',
    status: 'new',
    status_history: JSON.stringify([{ status: 'new', date: new Date().toISOString() }]),
    notes: '',
    applied_date: null,
    created_at: new Date().toISOString(),
  };
}

// Scheduled job-postings pull: imports all LinkedIn jobs posted in the past
// 24 hours for each user's saved titles, plus their companies as
// 'open_listing' entries. Jobs only by design — company research and contact
// finding (the Dream 100 / network pipeline) run on demand from the app.
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

      // Poll capped at 35 attempts (~3 minutes) to stay inside Cloudflare's
      // per-invocation subrequest limit
      let rawJobs = [];
      let completed = false;
      const maxAttempts = 35;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await delay(5000);

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
            completed = true;
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

        // Companies from new postings join the list as 'open_listing'
        const { results: existingCompanies } = await env.DB.prepare(
          'SELECT LOWER(name) as name FROM companies WHERE user_id = ?'
        ).bind(userId).all();
        const existingNames = new Set(existingCompanies.map((r) => r.name));

        const newCompanyNames = [...new Set(mappedJobs.map((j) => j.company))]
          .filter((name) => name && !existingNames.has(name.toLowerCase()));

        if (newCompanyNames.length > 0) {
          const companyStmt = env.DB.prepare(
            `INSERT INTO companies (id, user_id, name, industry, website, careers_url, linkedin_url, size, priority, status, why_dream, notes, contact_count, created_at)
             VALUES (?, ?, ?, '', '', '', '', '', 'medium', 'open_listing', '', '', 0, ?)`
          );
          const now = new Date().toISOString();
          await env.DB.batch(
            newCompanyNames.map((name) => companyStmt.bind(crypto.randomUUID(), userId, name, now))
          );
        }
      }

      // Mark today's refresh done so the in-app Daily Briefing doesn't
      // re-run the job search when the user opens the app
      if (completed) {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Edmonton' });
        await env.DB.prepare(
          'UPDATE settings SET last_daily_refresh = ? WHERE user_id = ?'
        ).bind(today, userId).run();
      }

      summary.push({ userId, newJobs: mappedJobs.length, completed });
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

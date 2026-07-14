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

const COMPANY_DATASET_ID = 'gd_l1vikfnt1wgvvqz95w';

export async function onRequestPost(context) {
  const { request, env, data } = context;

  try {
    const body = await request.json();
    const { industry, location, companySize, limit = 20 } = body;
    const brightDataApiKey = env.BRIGHT_DATA_API_KEY;
    const userId = data.user?.userId;

    if (!brightDataApiKey) {
      return jsonResponse({ error: 'BRIGHT_DATA_API_KEY not configured' }, 500);
    }

    if (!industry && !location && !companySize) {
      return jsonResponse({ error: 'At least one filter is required' }, 400);
    }

    // Build filter using only 'name' field (confirmed working) with industry as keyword
    // The 'industries', 'headquarters', 'company_size' fields may not support 'contains'
    const keyword = industry || location || '';
    const searchBody = {
      filter: {
        operator: 'and',
        filters: [
          { name: 'name', value: keyword, operator: 'contains' },
        ],
      },
      limit: Math.min(limit, 50),
    };

    // If we have industry, search by industry field using the same pattern as research
    if (industry) {
      searchBody.filter.filters = [
        { name: 'industries', value: industry, operator: 'contains' },
      ];
    }

    // Add location filter if provided
    if (location && industry) {
      searchBody.filter.filters.push(
        { name: 'headquarters', value: location, operator: 'contains' }
      );
    } else if (location && !industry) {
      searchBody.filter.filters = [
        { name: 'headquarters', value: location, operator: 'contains' },
      ];
    }

    const response = await fetch(
      `https://api.brightdata.com/datasets/search/${COMPANY_DATASET_ID}`,
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
      return jsonResponse({
        error: `Bright Data API returned ${response.status}: ${text.slice(0, 300)}`,
        requestSent: searchBody,
      }, 502);
    }

    const results = await response.json();
    const items = Array.isArray(results) ? results : (results.results || results.hits || []);

    // Get existing company names for this user to mark duplicates
    let existingNames = new Set();
    if (userId) {
      const { results: existing } = await env.DB.prepare(
        'SELECT LOWER(name) as name FROM companies WHERE user_id = ?'
      ).bind(userId).all();
      existingNames = new Set(existing.map((r) => r.name));
    }

    // Post-filter by company size in code (more reliable than API filter)
    const sizeFiltered = companySize
      ? items.filter((c) => {
          const size = c.company_size || '';
          return size.toLowerCase().includes(companySize.toLowerCase());
        })
      : items;

    const companies = sizeFiltered
      .filter((c) => c.name)
      .map((c) => ({
        name: c.name,
        website: c.website || null,
        linkedinUrl: c.url || c.linkedin_url || null,
        industry: Array.isArray(c.industries) ? c.industries.join(', ') : (c.industry || null),
        size: c.company_size || c.size || null,
        headquarters: c.headquarters || null,
        about: c.about || c.description || null,
        alreadyExists: existingNames.has(c.name.toLowerCase()),
      }));

    // Auto-save new companies to DB as 'new' status
    let savedCount = 0;
    if (userId) {
      for (const company of companies) {
        if (company.alreadyExists) continue;

        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO companies (id, user_id, name, industry, website, careers_url, linkedin_url, size, priority, status, why_dream, notes, contact_count, created_at)
           VALUES (?, ?, ?, ?, ?, '', ?, ?, 'medium', 'new', '', ?, 0, ?)`
        ).bind(
          id, userId, company.name,
          company.industry || '',
          company.website || '',
          company.linkedinUrl || '',
          company.size || '',
          company.about || '',
          new Date().toISOString()
        ).run();
        savedCount++;
      }
    }

    return jsonResponse({
      companies,
      savedCount,
      total: companies.length,
      alreadyExisted: companies.filter((c) => c.alreadyExists).length,
    });
  } catch (err) {
    console.error('discover-companies error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

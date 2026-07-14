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

// Canonical LinkedIn size buckets as stored in the Bright Data dataset
// (values appear as e.g. "1,001-5,000 employees" — 'includes' matches the prefix).
// Keyed by the comma-less form so legacy saved values like "1001-5000" still resolve.
const SIZE_BUCKETS = {
  '2-10': '2-10',
  '11-50': '11-50',
  '51-200': '51-200',
  '201-500': '201-500',
  '501-1000': '501-1,000',
  '1001-5000': '1,001-5,000',
  '5001-10000': '5,001-10,000',
  '10001+': '10,001+',
};

// Legacy composite ranges saved by older versions of the Settings UI
const LEGACY_SIZE_RANGES = {
  '201-1000': ['201-500', '501-1,000'],
};

function normalizeCompanySizes(sizes) {
  const out = new Set();
  for (const raw of sizes) {
    const key = String(raw).replace(/,/g, '').trim();
    if (SIZE_BUCKETS[key]) {
      out.add(SIZE_BUCKETS[key]);
    } else if (LEGACY_SIZE_RANGES[key]) {
      for (const v of LEGACY_SIZE_RANGES[key]) out.add(v);
    }
    // Unknown values are dropped rather than sent to the API
  }
  return [...out];
}

export async function onRequestPost(context) {
  try {
    const { request, env, data } = context;
    const body = await request.json();
    const { industries, country, region, companySizes, limit = 50 } = body;
    const brightDataApiKey = env.BRIGHT_DATA_API_KEY;
    const userId = data.user?.userId;

    if (!brightDataApiKey) {
      return jsonResponse({ error: 'BRIGHT_DATA_API_KEY not configured' }, 500);
    }

    if ((!industries || industries.length === 0) && !country) {
      return jsonResponse({ error: 'At least one industry or a country is required' }, 400);
    }

    // Bright Data rejects filter groups with more than 4 conditions
    // ("Filter validation failed", HTTP 500). Instead of OR groups, pass an
    // array as the 'includes' value — it matches records containing at least
    // one value from the array and counts as a single filter.
    const filters = [];
    if (Array.isArray(industries) && industries.length > 0) {
      filters.push({
        name: 'industries',
        operator: 'includes',
        value: industries.length === 1 ? industries[0] : industries,
      });
    }
    if (country) {
      filters.push({ name: 'country_code', operator: '=', value: country });
    }
    if (region) {
      filters.push({ name: 'headquarters', operator: 'includes', value: region });
    }
    if (Array.isArray(companySizes) && companySizes.length > 0) {
      const sizes = normalizeCompanySizes(companySizes);
      if (sizes.length > 0) {
        filters.push({
          name: 'company_size',
          operator: 'includes',
          value: sizes.length === 1 ? sizes[0] : sizes,
        });
      }
    }

    const searchBody = {
      size: Math.min(limit, 50),
      filter: filters.length === 1 ? filters[0] : { operator: 'and', filters },
    };

    let response;
    try {
      response = await fetch(
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
    } catch (fetchErr) {
      return jsonResponse({
        error: `Network error calling Bright Data: ${fetchErr.message}`,
        requestSent: searchBody,
      }, 502);
    }

    // 422 means the filter matched zero records — that's a valid empty result
    if (response.status === 422) {
      return jsonResponse({ companies: [], savedCount: 0, total: 0, alreadyExisted: 0 });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return jsonResponse({
        error: `Bright Data returned ${response.status}`,
        detail: text.slice(0, 500),
        requestSent: searchBody,
      }, 502);
    }

    let results;
    try {
      results = await response.json();
    } catch (parseErr) {
      return jsonResponse({
        error: `Failed to parse Bright Data response: ${parseErr.message}`,
        requestSent: searchBody,
      }, 502);
    }

    const items = results.hits || [];

    let existingNames = new Set();
    if (userId) {
      try {
        const { results: existing } = await env.DB.prepare(
          'SELECT LOWER(name) as name FROM companies WHERE user_id = ?'
        ).bind(userId).all();
        existingNames = new Set(existing.map((r) => r.name));
      } catch (dbErr) {
        return jsonResponse({ error: `DB error: ${dbErr.message}` }, 500);
      }
    }

    const companies = items
      .filter((c) => c.name)
      .map((c) => ({
        name: c.name,
        website: c.website || null,
        linkedinUrl: c.url || c.linkedin_url || null,
        industry: Array.isArray(c.industries) ? c.industries.join(', ') : (c.industries || c.industry || null),
        size: c.company_size || c.size || null,
        headquarters: c.headquarters || null,
        about: c.about || c.description || null,
        alreadyExists: existingNames.has(c.name.toLowerCase()),
      }));

    let savedCount = 0;
    if (userId) {
      for (const company of companies) {
        if (company.alreadyExists) continue;
        try {
          const id = crypto.randomUUID();
          await env.DB.prepare(
            `INSERT INTO companies (id, user_id, name, industry, website, careers_url, linkedin_url, size, priority, status, why_dream, notes, contact_count, created_at)
             VALUES (?, ?, ?, ?, ?, '', ?, ?, 'medium', 'new', '', '', 0, ?)`
          ).bind(
            id, userId, company.name,
            company.industry || '',
            company.website || '',
            company.linkedinUrl || '',
            company.size || '',
            new Date().toISOString()
          ).run();
          savedCount++;
        } catch (insertErr) {
          console.error(`Insert error for ${company.name}:`, insertErr);
        }
      }
    }

    return jsonResponse({
      companies,
      savedCount,
      total: companies.length,
      alreadyExisted: companies.filter((c) => c.alreadyExists).length,
    });
  } catch (err) {
    return jsonResponse({ error: err.message || 'Internal server error', stack: String(err.stack || '').slice(0, 500) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

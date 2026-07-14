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

// A discovery pull is batched across multiple requests: each invocation
// fetches up to PER_REQUEST records and returns a nextCursor; the client
// keeps calling until the pool is exhausted. The overall pull stays uncapped
// while each invocation stays inside Cloudflare's CPU/memory limits (dataset
// records are huge — 20-50KB each with post history and employee lists).
const PAGE_SIZE = 50;
const PER_REQUEST = 100;

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
    const { industries, country, region, companySizes, preview, searchAfter: cursorIn } = body;
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

    const filter = filters.length === 1 ? filters[0] : { operator: 'and', filters };
    // Preview mode fetches a single record just to read the match count
    // (zero-match queries are free; 1 record costs a fraction of a cent).
    const maxTotal = preview ? 1 : PER_REQUEST;

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

    const companies = [];
    const seenNames = new Set();
    let totalMatching = null;
    let searchAfter = Array.isArray(cursorIn) && cursorIn.length > 0 ? cursorIn : null;
    let poolExhausted = false;

    while (companies.length < maxTotal) {
      const searchBody = {
        size: Math.min(PAGE_SIZE, maxTotal - companies.length),
        sort: 'default',
        filter,
      };
      if (searchAfter) searchBody.search_after = searchAfter;

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

      // 422 means the filter matched zero records — a valid empty result
      if (response.status === 422) {
        poolExhausted = true;
        break;
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
        }, 502);
      }

      const items = results.hits || [];
      if (totalMatching === null) totalMatching = results.total_hits ?? null;

      for (const c of items) {
        if (!c.name) continue;
        const nameLower = c.name.toLowerCase();
        if (seenNames.has(nameLower)) continue;
        seenNames.add(nameLower);
        companies.push({
          name: c.name,
          website: c.website || null,
          linkedinUrl: c.url || c.linkedin_url || null,
          industry: Array.isArray(c.industries) ? c.industries.join(', ') : (c.industries || c.industry || null),
          size: c.company_size || c.size || null,
          headquarters: c.headquarters || null,
          alreadyExists: existingNames.has(nameLower),
        });
      }

      searchAfter = results.search_after;
      if (!searchAfter || items.length === 0) {
        poolExhausted = true;
        break;
      }
    }

    const nextCursor = !preview && !poolExhausted && searchAfter ? searchAfter : null;

    if (preview) {
      return jsonResponse({
        preview: true,
        totalMatching,
        companies: [],
        savedCount: 0,
        total: 0,
        alreadyExisted: 0,
      });
    }

    let savedCount = 0;
    if (userId) {
      const toInsert = companies.filter((c) => !c.alreadyExists);
      const now = new Date().toISOString();
      const stmt = env.DB.prepare(
        `INSERT INTO companies (id, user_id, name, industry, website, careers_url, linkedin_url, size, priority, status, why_dream, notes, contact_count, created_at)
         VALUES (?, ?, ?, ?, ?, '', ?, ?, 'medium', 'new', '', '', 0, ?)`
      );
      // Chunked batches: one D1 call per 50 rows instead of one per row
      for (let i = 0; i < toInsert.length; i += 50) {
        const chunk = toInsert.slice(i, i + 50);
        try {
          await env.DB.batch(
            chunk.map((company) =>
              stmt.bind(
                crypto.randomUUID(), userId, company.name,
                company.industry || '',
                company.website || '',
                company.linkedinUrl || '',
                company.size || '',
                now
              )
            )
          );
          savedCount += chunk.length;
        } catch (insertErr) {
          console.error(`Batch insert error (rows ${i}-${i + chunk.length}):`, insertErr);
        }
      }
    }

    return jsonResponse({
      companies,
      savedCount,
      total: companies.length,
      alreadyExisted: companies.filter((c) => c.alreadyExists).length,
      totalMatching,
      nextCursor,
    });
  } catch (err) {
    return jsonResponse({ error: err.message || 'Internal server error', stack: String(err.stack || '').slice(0, 500) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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
  const { request, env } = context;

  try {
    const body = await request.json();
    const { companyName } = body;
    const brightDataApiKey = env.BRIGHT_DATA_API_KEY;

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
          { name: 'name', value: companyName, operator: 'contains' },
        ],
      },
      limit: 3,
    };

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
      return jsonResponse({ error: `Bright Data error (${response.status}): ${text}` }, 502);
    }

    const results = await response.json();
    const items = Array.isArray(results) ? results : (results.results || []);

    if (items.length === 0) {
      return jsonResponse({
        name: companyName,
        website: null,
        careersUrl: null,
        linkedinUrl: null,
        industry: null,
        size: null,
        summary: null,
        headquarters: null,
        specialties: null,
        founded: null,
        notFound: true,
      });
    }

    const company = items[0];

    const companyData = {
      name: company.name || companyName,
      website: company.website || null,
      careersUrl: null,
      linkedinUrl: company.url || company.linkedin_url || null,
      industry: Array.isArray(company.industries)
        ? company.industries.join(', ')
        : (company.industry || null),
      size: company.company_size || company.size || null,
      summary: company.about || company.description || null,
      headquarters: company.headquarters || null,
      specialties: company.specialties || null,
      founded: company.founded || null,
    };

    return jsonResponse(companyData);
  } catch (err) {
    console.error('research-company error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

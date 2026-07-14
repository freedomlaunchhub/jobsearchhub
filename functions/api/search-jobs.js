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

const SOURCE_SITE_MAP = {
  linkedin: 'site:linkedin.com/jobs',
  indeed: 'site:indeed.ca',
};

async function searchBrightData(query, brightDataApiKey, zone) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&gl=ca&brd_json=1`;
  const response = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${brightDataApiKey}`,
    },
    body: JSON.stringify({
      zone,
      url: searchUrl,
      format: 'raw',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bright Data API error (${response.status}): ${text}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 5000) };
  }
}

async function normalizeWithAnthropic(rawResults, titles, location, anthropicApiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract and normalize job listings from the following search results into a structured JSON array.

Target job titles: ${titles.join(', ')}
Target location: ${location}

Search results:
${JSON.stringify(rawResults, null, 2)}

Return a JSON array where each job object has these fields:
- id: a unique identifier (use a hash of title + company)
- title: the job title
- company: the company name
- location: the job location
- url: the link to the job posting
- source: which job board it came from (linkedin, indeed, or other)
- salary: salary info if available, otherwise null
- postedDate: when it was posted if available, otherwise null
- description: a brief description or snippet if available

Return ONLY valid JSON, no other text. If no jobs are found, return an empty array [].`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  return JSON.parse(jsonMatch[0]);
}

function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${(job.title || '').toLowerCase().trim()}|${(job.company || '').toLowerCase().trim()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const { titles, location, includeRemote, sources } = body;
    const brightDataApiKey = body.brightDataApiKey || env.BRIGHT_DATA_API_KEY;
    const anthropicApiKey = body.anthropicApiKey || env.ANTHROPIC_API_KEY;
    const brightDataZone = body.brightDataZone || env.BRIGHT_DATA_ZONE || 'serp_api';

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return jsonResponse({ error: 'titles is required and must be a non-empty array' }, 400);
    }
    if (!location) {
      return jsonResponse({ error: 'location is required' }, 400);
    }
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return jsonResponse({ error: 'sources is required and must be a non-empty array' }, 400);
    }
    if (!brightDataApiKey) {
      return jsonResponse({ error: 'brightDataApiKey is required' }, 400);
    }
    if (!anthropicApiKey) {
      return jsonResponse({ error: 'anthropicApiKey is required' }, 400);
    }

    const titleQuery = titles.map((t) => `"${t}"`).join(' OR ');
    const locationQuery = includeRemote ? `${location} OR remote` : location;
    const sourcesSearched = [];
    const allRawResults = [];

    // Search each source via Bright Data SERP
    const searchPromises = sources
      .filter((source) => SOURCE_SITE_MAP[source])
      .map(async (source) => {
        const siteFilter = SOURCE_SITE_MAP[source];
        const query = `${titleQuery} jobs ${locationQuery} ${siteFilter}`;
        try {
          const results = await searchBrightData(query, brightDataApiKey, brightDataZone);
          sourcesSearched.push(source);
          return { source, results };
        } catch (err) {
          console.error(`Error searching ${source}:`, err.message);
          return { source, results: null, error: err.message };
        }
      });

    const searchResults = await Promise.all(searchPromises);

    for (const result of searchResults) {
      if (result.results) {
        allRawResults.push(result);
      }
    }

    if (allRawResults.length === 0) {
      const firstError = searchResults.find((r) => r.error)?.error;
      return jsonResponse({
        jobs: [],
        searchedAt: new Date().toISOString(),
        sourcesSearched,
        error: firstError || 'No results returned from any source',
      });
    }

    // Normalize results with Anthropic
    const normalizedJobs = await normalizeWithAnthropic(
      allRawResults,
      titles,
      location,
      anthropicApiKey
    );

    // Deduplicate
    const uniqueJobs = deduplicateJobs(normalizedJobs);

    return jsonResponse({
      jobs: uniqueJobs,
      searchedAt: new Date().toISOString(),
      sourcesSearched,
    });
  } catch (err) {
    console.error('search-jobs error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

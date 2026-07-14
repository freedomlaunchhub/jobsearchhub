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

async function generateHash(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function isJobUrl(url, source) {
  if (!url) return false;
  if (source === 'linkedin') {
    return url.includes('linkedin.com/jobs/');
  }
  if (source === 'indeed') {
    return url.includes('indeed.ca/') || url.includes('indeed.com/');
  }
  return true;
}

function parseSerpTitle(title, source) {
  if (!title) return { title: null, company: null, location: null };

  if (source === 'linkedin') {
    // LinkedIn patterns:
    // "Job Title - Company | LinkedIn"
    // "Job Title - Location - Company | LinkedIn"
    // "Job Title | Company | LinkedIn"
    const cleaned = title.replace(/\s*\|\s*LinkedIn\s*$/, '').replace(/\s*-\s*LinkedIn\s*$/, '');

    const pipeMatch = cleaned.match(/^(.+?)\s*\|\s*(.+)$/);
    if (pipeMatch) {
      return { title: pipeMatch[1].trim(), company: pipeMatch[2].trim(), location: null };
    }

    const parts = cleaned.split(/\s*[-–—]\s*/);
    if (parts.length >= 3) {
      return { title: parts[0].trim(), company: parts[parts.length - 1].trim(), location: parts.slice(1, -1).join(', ').trim() };
    }
    if (parts.length === 2) {
      return { title: parts[0].trim(), company: parts[1].trim(), location: null };
    }
    return { title: cleaned.trim(), company: null, location: null };
  }

  if (source === 'indeed') {
    // Indeed patterns:
    // "Job Title - Company - Location | Indeed.com"
    // "Job Title - Location | Indeed"
    const cleaned = title.replace(/\s*\|\s*Indeed\.?(com|ca)?\s*$/i, '');
    const parts = cleaned.split(/\s*[-–—]\s*/);
    if (parts.length >= 3) {
      return { title: parts[0].trim(), company: parts[1].trim(), location: parts.slice(2).join(', ').trim() };
    }
    if (parts.length === 2) {
      return { title: parts[0].trim(), company: parts[1].trim(), location: null };
    }
    return { title: cleaned.trim(), company: null, location: null };
  }

  return { title: title.trim(), company: null, location: null };
}

function extractSalaryFromText(text) {
  if (!text) return null;
  const match = text.match(/\$[\d,]+(?:\s*[-–—to]+\s*\$[\d,]+)?(?:\s*(?:\/|per|a)\s*(?:year|yr|hour|hr|annum))?/i)
    || text.match(/CA\$[\d,]+(?:\s*[-–—to]+\s*CA\$[\d,]+)?/i)
    || text.match(/\$[\d]+[Kk]\s*[-–—to]+\s*\$[\d]+[Kk]/);
  return match ? match[0] : null;
}

function extractPostedDate(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\+?\s*days?\s*ago/i)
    || text.match(/posted\s+(\d+)\+?\s*days?\s*ago/i);
  if (match) {
    const daysAgo = parseInt(match[1], 10);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }
  const hourMatch = text.match(/(\d+)\+?\s*hours?\s*ago/i);
  if (hourMatch) {
    return new Date().toISOString().split('T')[0];
  }
  return null;
}

async function parseOrganicResults(serpData, source) {
  const organic = serpData?.organic || [];
  const jobs = [];

  for (const result of organic) {
    if (!isJobUrl(result.link, source)) continue;

    const parsed = parseSerpTitle(result.title, source);
    if (!parsed.title) continue;

    const snippet = result.description || result.snippet || '';
    const id = await generateHash(result.link);

    jobs.push({
      id,
      title: parsed.title,
      company: parsed.company || '',
      location: parsed.location || '',
      url: result.link,
      source,
      salary: extractSalaryFromText(snippet) || extractSalaryFromText(result.title),
      postedDate: extractPostedDate(snippet),
      description: snippet,
    });
  }

  return jobs;
}

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

function deduplicateJobs(jobs) {
  const seenUrls = new Set();
  const seenTitleCompany = new Set();
  return jobs.filter((job) => {
    const urlKey = job.url?.toLowerCase().trim();
    const titleCompanyKey = `${(job.title || '').toLowerCase().trim()}|${(job.company || '').toLowerCase().trim()}`;

    if (urlKey && seenUrls.has(urlKey)) return false;
    if (seenTitleCompany.has(titleCompanyKey)) return false;

    if (urlKey) seenUrls.add(urlKey);
    seenTitleCompany.add(titleCompanyKey);
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

    const titleQuery = titles.map((t) => `"${t}"`).join(' OR ');
    const locationQuery = includeRemote ? `${location} OR remote` : location;
    const sourcesSearched = [];
    const allJobs = [];

    const searchPromises = sources
      .filter((source) => SOURCE_SITE_MAP[source])
      .map(async (source) => {
        const siteFilter = SOURCE_SITE_MAP[source];
        const query = `${titleQuery} jobs ${locationQuery} ${siteFilter}`;
        try {
          const serpData = await searchBrightData(query, brightDataApiKey, brightDataZone);
          sourcesSearched.push(source);
          const jobs = await parseOrganicResults(serpData, source);
          return { source, jobs };
        } catch (err) {
          console.error(`Error searching ${source}:`, err.message);
          return { source, jobs: [], error: err.message };
        }
      });

    const searchResults = await Promise.all(searchPromises);

    for (const result of searchResults) {
      allJobs.push(...result.jobs);
    }

    if (allJobs.length === 0) {
      const firstError = searchResults.find((r) => r.error)?.error;
      return jsonResponse({
        jobs: [],
        searchedAt: new Date().toISOString(),
        sourcesSearched,
        error: firstError || 'No job listings found in search results',
      });
    }

    const uniqueJobs = deduplicateJobs(allJobs);

    return jsonResponse({
      jobs: uniqueJobs,
      searchedAt: new Date().toISOString(),
      sourcesSearched,
    });
  } catch (err) {
    console.error('search-jobs error:', err);
    return jsonResponse({ error: `search-jobs: ${err.message || 'Internal server error'}` }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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

async function generateHash(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function isWithinOneWeek(dateStr) {
  if (!dateStr) return true;
  const posted = new Date(dateStr);
  if (isNaN(posted.getTime())) return true;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return posted >= oneWeekAgo;
}

// Bright Data Web Data API for LinkedIn job listings
async function fetchLinkedInJobs(titles, location, includeRemote, brightDataApiKey) {
  const keyword = titles.join(' OR ');
  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&f_TPR=r604800`;

  const response = await fetch('https://api.brightdata.com/datasets/v3/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${brightDataApiKey}`,
    },
    body: JSON.stringify([{ url: searchUrl }]),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bright Data Web Data API error (${response.status}): ${text}`);
  }

  const result = await response.json();

  // The Web Data API may return results directly or a snapshot ID for async retrieval
  if (result.snapshot_id) {
    return await pollSnapshot(result.snapshot_id, brightDataApiKey);
  }

  return Array.isArray(result) ? result : (result.data || result.results || []);
}

async function pollSnapshot(snapshotId, brightDataApiKey) {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));

    const response = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`, {
      headers: { Authorization: `Bearer ${brightDataApiKey}` },
    });

    if (response.status === 200) {
      return await response.json();
    }
    if (response.status !== 202) {
      const text = await response.text();
      throw new Error(`Snapshot poll error (${response.status}): ${text}`);
    }
  }
  throw new Error('Snapshot polling timed out');
}

async function parseLinkedInWebData(listings) {
  const jobs = [];

  for (const listing of listings) {
    if (!listing.job_title && !listing.title) continue;

    const url = listing.url || listing.job_url || listing.link || '';
    const id = await generateHash(url || `${listing.job_title || listing.title}-${listing.company_name || listing.company}`);
    const postedDate = listing.job_posted_date || listing.posted_date || listing.date_posted || null;

    if (!isWithinOneWeek(postedDate)) continue;

    const isActive = !listing.job_status
      || listing.job_status === 'Active'
      || listing.job_status === 'Open'
      || listing.job_status === 'Actively recruiting';
    if (listing.job_status && !isActive) continue;

    jobs.push({
      id,
      title: listing.job_title || listing.title || '',
      company: listing.company_name || listing.company || '',
      location: listing.job_location || listing.location || '',
      url,
      source: 'linkedin',
      salary: listing.job_salary || listing.salary || null,
      postedDate,
      description: listing.job_description || listing.description || '',
      remote: (listing.job_location || listing.location || '').toLowerCase().includes('remote')
        || (listing.workplace_type || '').toLowerCase().includes('remote'),
      employmentType: listing.employment_type || listing.job_type || null,
      applicantCount: listing.applicant_count || listing.num_applicants || null,
      experienceLevel: listing.experience_level || listing.seniority_level || null,
    });
  }

  return jobs;
}

// SERP-based fallback for Indeed
const INDEED_SITE_FILTER = 'site:indeed.ca';

function isIndeedUrl(url) {
  if (!url) return false;
  return url.includes('indeed.ca/') || url.includes('indeed.com/');
}

function parseIndeedSerpTitle(title) {
  if (!title) return { title: null, company: null, location: null };
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
    if (daysAgo > 7) return null;
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

async function searchIndeedViaSERP(titles, location, includeRemote, brightDataApiKey, zone) {
  const titleQuery = titles.map((t) => `"${t}"`).join(' OR ');
  const locationQuery = includeRemote ? `${location} OR remote` : location;
  const query = `${titleQuery} jobs ${locationQuery} ${INDEED_SITE_FILTER}`;
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
    throw new Error(`Bright Data SERP error (${response.status}): ${text}`);
  }

  const text = await response.text();
  let serpData;
  try {
    serpData = JSON.parse(text);
  } catch {
    return [];
  }

  const organic = serpData?.organic || [];
  const jobs = [];

  for (const result of organic) {
    if (!isIndeedUrl(result.link)) continue;
    const parsed = parseIndeedSerpTitle(result.title);
    if (!parsed.title) continue;

    const snippet = result.description || result.snippet || '';
    const postedDate = extractPostedDate(snippet);

    if (postedDate === null && snippet.match(/(\d+)\+?\s*days?\s*ago/i)) continue;

    const id = await generateHash(result.link);
    jobs.push({
      id,
      title: parsed.title,
      company: parsed.company || '',
      location: parsed.location || '',
      url: result.link,
      source: 'indeed',
      salary: extractSalaryFromText(snippet) || extractSalaryFromText(result.title),
      postedDate,
      description: snippet,
    });
  }

  return jobs;
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

    const sourcesSearched = [];
    const allJobs = [];
    const searchPromises = [];

    if (sources.includes('linkedin')) {
      searchPromises.push(
        fetchLinkedInJobs(titles, location, includeRemote, brightDataApiKey)
          .then(async (listings) => {
            sourcesSearched.push('linkedin');
            const jobs = await parseLinkedInWebData(listings);
            return { source: 'linkedin', jobs };
          })
          .catch((err) => {
            console.error('Error fetching LinkedIn jobs:', err.message);
            return { source: 'linkedin', jobs: [], error: err.message };
          })
      );
    }

    if (sources.includes('indeed')) {
      searchPromises.push(
        searchIndeedViaSERP(titles, location, includeRemote, brightDataApiKey, brightDataZone)
          .then((jobs) => {
            sourcesSearched.push('indeed');
            return { source: 'indeed', jobs };
          })
          .catch((err) => {
            console.error('Error searching Indeed:', err.message);
            return { source: 'indeed', jobs: [], error: err.message };
          })
      );
    }

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

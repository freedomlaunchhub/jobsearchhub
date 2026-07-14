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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const { titles, location, country, includeRemote } = body;
    const brightDataApiKey = body.brightDataApiKey || env.BRIGHT_DATA_API_KEY;

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return jsonResponse({ error: 'titles is required and must be a non-empty array' }, 400);
    }
    if (!location) {
      return jsonResponse({ error: 'location is required' }, 400);
    }
    if (!brightDataApiKey) {
      return jsonResponse({ error: 'brightDataApiKey is required' }, 400);
    }

    // Build inputs for Bright Data LinkedIn Jobs dataset
    const inputs = titles.map((title) => {
      const input = {
        keyword: title,
        location: location,
        country: country || 'CA',
        time_range: 'Past week',
        selective_search: true,
      };
      if (includeRemote) {
        input.remote = 'Remote';
      }
      return input;
    });

    // Trigger the dataset collection
    const triggerUrl = 'https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lpfll7v5hcqtkxl6l&format=json&type=discover_new';
    const triggerResponse = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${brightDataApiKey}`,
      },
      body: JSON.stringify(inputs),
    });

    if (!triggerResponse.ok) {
      const text = await triggerResponse.text();
      return jsonResponse({ error: `Bright Data trigger error (${triggerResponse.status}): ${text}` }, 502);
    }

    const triggerData = await triggerResponse.json();
    const snapshotId = triggerData.snapshot_id;

    if (!snapshotId) {
      return jsonResponse({ error: 'No snapshot_id returned from Bright Data', triggerData }, 502);
    }

    // Poll for up to ~25 seconds
    const maxAttempts = 12;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await delay(2000);

      const progressResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
        {
          headers: { Authorization: `Bearer ${brightDataApiKey}` },
        }
      );

      if (!progressResponse.ok) continue;

      const progressData = await progressResponse.json();
      const status = progressData.status;

      if (status === 'ready') {
        // Download results
        const snapshotResponse = await fetch(
          `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
          {
            headers: { Authorization: `Bearer ${brightDataApiKey}` },
          }
        );

        if (!snapshotResponse.ok) {
          const text = await snapshotResponse.text();
          return jsonResponse({ error: `Bright Data snapshot error: ${text}` }, 502);
        }

        const jobs = await snapshotResponse.json();
        return jsonResponse({
          jobs: Array.isArray(jobs) ? jobs : [],
          searchedAt: new Date().toISOString(),
          snapshotId,
        });
      }

      if (status === 'failed') {
        return jsonResponse({ error: 'Bright Data job search failed', progressData }, 502);
      }
    }

    // Not ready yet — return snapshotId for client to poll
    return jsonResponse({
      pending: true,
      snapshotId,
      searchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('search-jobs error:', err);
    return jsonResponse({ error: `search-jobs: ${err.message || 'Internal server error'}` }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

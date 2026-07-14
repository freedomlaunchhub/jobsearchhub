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

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const { snapshotId } = body;
    const brightDataApiKey = body.brightDataApiKey || env.BRIGHT_DATA_API_KEY;

    if (!snapshotId) {
      return jsonResponse({ error: 'snapshotId is required' }, 400);
    }
    if (!brightDataApiKey) {
      return jsonResponse({ error: 'brightDataApiKey is required' }, 400);
    }

    // Check progress
    const progressResponse = await fetch(
      `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
      {
        headers: { Authorization: `Bearer ${brightDataApiKey}` },
      }
    );

    if (!progressResponse.ok) {
      const text = await progressResponse.text();
      return jsonResponse({ error: `Progress check failed: ${text}` }, 502);
    }

    const progressData = await progressResponse.json();
    const status = progressData.status;

    if (status === 'ready') {
      const snapshotResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
        {
          headers: { Authorization: `Bearer ${brightDataApiKey}` },
        }
      );

      if (!snapshotResponse.ok) {
        const text = await snapshotResponse.text();
        return jsonResponse({ error: `Snapshot download failed: ${text}` }, 502);
      }

      const jobs = await snapshotResponse.json();
      return jsonResponse({
        jobs: Array.isArray(jobs) ? jobs : [],
        searchedAt: new Date().toISOString(),
      });
    }

    if (status === 'failed') {
      return jsonResponse({ error: 'Job search failed on Bright Data', progressData }, 502);
    }

    return jsonResponse({ pending: true, status: progressData.status });
  } catch (err) {
    console.error('job-status error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestGet(context) {
  const { env } = context;
  const results = {
    timestamp: new Date().toISOString(),
    secrets: {
      BRIGHT_DATA_API_KEY: env.BRIGHT_DATA_API_KEY ? `set (${env.BRIGHT_DATA_API_KEY.length} chars)` : 'NOT SET',
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY ? `set (${env.ANTHROPIC_API_KEY.length} chars)` : 'NOT SET',
    },
    tests: {},
  };

  // Test: Trigger LinkedIn Jobs dataset via Bright Data
  if (env.BRIGHT_DATA_API_KEY) {
    try {
      const triggerUrl = 'https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lpfll7v5hcqtkxl6l&format=json&type=discover_new&limit_per_input=3';
      const inputs = [
        {
          keyword: 'Project Manager',
          location: 'Calgary',
          country: 'CA',
          time_range: 'Past week',
          selective_search: true,
        },
      ];

      const triggerResponse = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
        },
        body: JSON.stringify({ input: inputs }),
      });

      const triggerText = await triggerResponse.text();
      let triggerData = null;
      try { triggerData = JSON.parse(triggerText); } catch { /* raw text */ }

      results.tests.linkedinTrigger = {
        status: triggerResponse.status,
        ok: triggerResponse.ok,
        response: triggerData || triggerText.slice(0, 2000),
      };

      // If we got a snapshot_id, poll once after 3 seconds
      const snapshotId = triggerData?.snapshot_id;
      if (snapshotId) {
        await new Promise((r) => setTimeout(r, 3000));

        const progressResponse = await fetch(
          `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
          { headers: { Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}` } }
        );
        const progressData = await progressResponse.json();

        results.tests.linkedinProgress = {
          status: progressResponse.status,
          snapshotId,
          progressStatus: progressData.status,
          progressData,
        };

        // If already ready, download a sample
        if (progressData.status === 'ready') {
          const snapshotResponse = await fetch(
            `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
            { headers: { Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}` } }
          );
          const jobs = await snapshotResponse.json();
          const sample = Array.isArray(jobs) ? jobs.slice(0, 2) : jobs;
          results.tests.linkedinResults = {
            totalJobs: Array.isArray(jobs) ? jobs.length : 'not an array',
            sampleKeys: Array.isArray(jobs) && jobs[0] ? Object.keys(jobs[0]) : null,
            sample,
          };
        }
      }
    } catch (err) {
      results.tests.linkedinTrigger = { error: err.message };
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

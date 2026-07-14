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
      BRIGHT_DATA_ZONE: env.BRIGHT_DATA_ZONE || 'NOT SET (will default to serp_api)',
    },
    tests: {},
  };

  // Test: Real job search via Bright Data SERP
  if (env.BRIGHT_DATA_API_KEY) {
    try {
      const zone = env.BRIGHT_DATA_ZONE || 'serp_api';
      const searchUrl = 'https://www.google.com/search?q=%22Project+Manager%22+jobs+Calgary+site%3Alinkedin.com%2Fjobs&num=5&gl=ca&brd_json=1';
      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
        },
        body: JSON.stringify({ zone, url: searchUrl, format: 'raw' }),
      });
      const text = await response.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* raw text */ }

      results.tests.jobSearch = {
        status: response.status,
        ok: response.ok,
        topLevelKeys: parsed ? Object.keys(parsed) : null,
        fullResponse: parsed || text.slice(0, 3000),
      };
    } catch (err) {
      results.tests.jobSearch = { error: err.message };
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

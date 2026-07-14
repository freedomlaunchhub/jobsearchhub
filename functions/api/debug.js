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

  // Test 1: Bright Data SERP
  if (env.BRIGHT_DATA_API_KEY) {
    try {
      const zone = env.BRIGHT_DATA_ZONE || 'serp_api';
      const searchUrl = 'https://www.google.com/search?q=test&num=3&gl=ca&brd_json=1';
      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
        },
        body: JSON.stringify({ zone, url: searchUrl, format: 'raw' }),
      });
      const text = await response.text();
      results.tests.brightData = {
        status: response.status,
        ok: response.ok,
        bodyPreview: text.slice(0, 500),
      };
    } catch (err) {
      results.tests.brightData = { error: err.message };
    }
  } else {
    results.tests.brightData = { error: 'No API key set' };
  }

  // Test 2: Anthropic API
  if (env.ANTHROPIC_API_KEY) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Reply with just the word "ok"' }],
        }),
      });
      const text = await response.text();
      results.tests.anthropic = {
        status: response.status,
        ok: response.ok,
        bodyPreview: text.slice(0, 500),
      };
    } catch (err) {
      results.tests.anthropic = { error: err.message };
    }
  } else {
    results.tests.anthropic = { error: 'No API key set' };
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

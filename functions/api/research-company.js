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
    const { companyName, location } = body;
    const brightDataApiKey = body.brightDataApiKey || env.BRIGHT_DATA_API_KEY;
    const anthropicApiKey = body.anthropicApiKey || env.ANTHROPIC_API_KEY;
    const brightDataZone = body.brightDataZone || env.BRIGHT_DATA_ZONE || 'serp_api';

    if (!companyName) {
      return jsonResponse({ error: 'companyName is required' }, 400);
    }
    if (!brightDataApiKey) {
      return jsonResponse({ error: 'brightDataApiKey is required' }, 400);
    }
    if (!anthropicApiKey) {
      return jsonResponse({ error: 'anthropicApiKey is required' }, 400);
    }

    // Step 1: Search for company info via Bright Data SERP
    const query = `${companyName} ${location || ''} careers company overview`.trim();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&gl=ca&brd_json=1`;
    const serpResponse = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${brightDataApiKey}`,
      },
      body: JSON.stringify({
        zone: brightDataZone,
        url: searchUrl,
        format: 'raw',
      }),
    });

    if (!serpResponse.ok) {
      const text = await serpResponse.text();
      return jsonResponse({ error: `Bright Data API error (${serpResponse.status}): ${text}` }, 502);
    }

    const serpText = await serpResponse.text();
    let serpResults;
    try {
      serpResults = JSON.parse(serpText);
    } catch {
      serpResults = { raw: serpText.slice(0, 5000) };
    }

    // Step 2: Use Anthropic to summarize into structured company data
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Analyze the following search results about "${companyName}" and extract structured company information.

Search results:
${JSON.stringify(serpResults, null, 2)}

Return a JSON object with these fields:
- name: the official company name
- website: the company's main website URL (null if not found)
- careersUrl: the company's careers/jobs page URL (null if not found)
- linkedinUrl: the company's LinkedIn page URL (null if not found)
- industry: the industry the company operates in (null if not found)
- size: approximate company size or employee count (null if not found)
- summary: a 2-3 sentence overview of the company, what they do, and their culture

Return ONLY valid JSON, no other text.`,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const text = await anthropicResponse.text();
      return jsonResponse({ error: `Anthropic API error (${anthropicResponse.status}): ${text}` }, 502);
    }

    const anthropicData = await anthropicResponse.json();
    const content = anthropicData.content[0].text;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return jsonResponse({ error: 'Failed to parse company data from AI response' }, 500);
    }

    const companyData = JSON.parse(jsonMatch[0]);

    return jsonResponse(companyData);
  } catch (err) {
    console.error('research-company error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

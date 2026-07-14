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
    const { name, title, company, linkedinUrl } = body;
    const brightDataApiKey = body.brightDataApiKey || env.BRIGHT_DATA_API_KEY;
    const anthropicApiKey = body.anthropicApiKey || env.ANTHROPIC_API_KEY;

    if (!name) {
      return jsonResponse({ error: 'name is required' }, 400);
    }
    if (!company) {
      return jsonResponse({ error: 'company is required' }, 400);
    }
    if (!brightDataApiKey) {
      return jsonResponse({ error: 'brightDataApiKey is required' }, 400);
    }
    if (!anthropicApiKey) {
      return jsonResponse({ error: 'anthropicApiKey is required' }, 400);
    }

    // Step 1: Run two SERP searches in parallel
    const generalQuery = `${name} ${company} ${title || ''}`.trim();
    const linkedinQuery = `${name} site:linkedin.com`;

    const [generalResults, linkedinResults] = await Promise.all([
      fetchSerp(generalQuery, brightDataApiKey),
      fetchSerp(linkedinQuery, brightDataApiKey),
    ]);

    // Step 2: Use Anthropic to generate structured contact research
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3072,
        messages: [
          {
            role: 'user',
            content: `You are a professional networking research assistant. Analyze the following search results about a person and generate actionable networking intelligence.

Person details:
- Name: ${name}
- Title: ${title || 'Unknown'}
- Company: ${company}
${linkedinUrl ? `- LinkedIn: ${linkedinUrl}` : ''}

General search results:
${JSON.stringify(generalResults, null, 2)}

LinkedIn search results:
${JSON.stringify(linkedinResults, null, 2)}

Return a JSON object with the following fields:

1. "rapportNotes": An array of 3-5 specific, actionable things about this person that can be used to build genuine rapport. These should be based on their professional background, interests, published content, speaking engagements, shared connections, or industry involvement. Each note should be a string that explains what the commonality is and how to reference it naturally in conversation. Avoid generic observations -- focus on specific details that show you've done your research.

2. "connectionMessages": An array of exactly 3 personalized LinkedIn connection request messages. Each must be:
   - Under 300 characters (this is a hard LinkedIn limit)
   - Reference something specific about the person or their work
   - Include a clear reason for connecting
   - Sound natural and human, not templated
   - Vary in approach (e.g., one referencing shared interest, one referencing their work, one referencing industry)

3. "followUpMessage": A single follow-up message to send after they accept the connection request. Should be 2-4 sentences, reference something from the connection request context, and suggest a specific next step (like a brief call or coffee chat). Should feel warm but professional.

4. "socialProfiles": An array of objects with { platform, url, username } for any social profiles found in the search results (LinkedIn, Twitter/X, GitHub, personal website, etc.). Only include profiles you have reasonable confidence belong to this person.

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
      return jsonResponse({ error: 'Failed to parse contact research from AI response' }, 500);
    }

    const contactData = JSON.parse(jsonMatch[0]);

    return jsonResponse(contactData);
  } catch (err) {
    console.error('research-contact error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

async function fetchSerp(query, brightDataApiKey) {
  try {
    const response = await fetch('https://api.brightdata.com/serp/req', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${brightDataApiKey}`,
      },
      body: JSON.stringify({
        query,
        country: 'ca',
        num_results: 20,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Bright Data SERP error for "${query}": ${text}`);
      return null;
    }

    return response.json();
  } catch (err) {
    console.error(`Bright Data SERP error for "${query}":`, err.message);
    return null;
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

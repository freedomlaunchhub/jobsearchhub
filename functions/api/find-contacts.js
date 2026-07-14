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

const DEFAULT_TARGET_ROLES = [
  'VP Product',
  'Director PMO',
  'Head of Product',
  'VP Engineering',
  'Director of Change Management',
  'Chief Product Officer',
];

export async function onRequestPost(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const {
      companyName,
      industry,
      targetRoles = DEFAULT_TARGET_ROLES,
      brightDataApiKey,
      anthropicApiKey,
    } = body;

    if (!companyName) {
      return jsonResponse({ error: 'companyName is required' }, 400);
    }
    if (!brightDataApiKey) {
      return jsonResponse({ error: 'brightDataApiKey is required' }, 400);
    }
    if (!anthropicApiKey) {
      return jsonResponse({ error: 'anthropicApiKey is required' }, 400);
    }

    // Step 1: Batch roles into groups of 2-3 and run SERP searches
    const roleBatches = [];
    for (let i = 0; i < targetRoles.length; i += 3) {
      roleBatches.push(targetRoles.slice(i, i + 3));
    }

    const serpPromises = roleBatches.map((batch) => {
      const roleQuery = batch.map((role) => `"${role}"`).join(' OR ');
      const query = `"${companyName}" ${roleQuery} site:linkedin.com/in`;
      return fetchSerp(query, brightDataApiKey);
    });

    const serpResults = await Promise.all(serpPromises);

    // Step 2: Use Anthropic to extract structured contacts from search results
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
            content: `You are a professional networking research assistant. Analyze the following search results and extract key contacts at ${companyName}${industry ? ` (industry: ${industry})` : ''}.

Target roles we are looking for: ${targetRoles.join(', ')}

Search results:
${JSON.stringify(serpResults, null, 2)}

Return a JSON object with a single field "contacts" containing an array of up to 5 contacts. Each contact should have:
- "name": The person's full name
- "title": Their job title
- "linkedinUrl": Their LinkedIn profile URL (must be a linkedin.com/in/ URL)
- "company": The company they work at (should be "${companyName}" or a close variant)

Rules:
- Only include people you are confident actually work at ${companyName} based on the search results
- Deduplicate by name -- if the same person appears multiple times, include them only once
- Prioritize the target roles listed above
- Maximum 5 contacts
- Only include contacts where you have reasonable confidence in the data
- If a LinkedIn URL is not available, omit the linkedinUrl field

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
      return jsonResponse({ error: 'Failed to parse contacts from AI response' }, 500);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Deduplicate by name (case-insensitive) and limit to 5
    const seen = new Set();
    const dedupedContacts = [];
    for (const contact of parsed.contacts || []) {
      const key = contact.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        dedupedContacts.push(contact);
      }
      if (dedupedContacts.length >= 5) break;
    }

    return jsonResponse({
      contacts: dedupedContacts,
      companyName,
      searchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('find-contacts error:', err);
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

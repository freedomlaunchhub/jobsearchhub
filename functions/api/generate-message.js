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

const MESSAGE_PROMPTS = {
  connection: (contactName, contactTitle, company, rapportNotes, additionalContext) =>
    `Write a LinkedIn connection request message to ${contactName}, who is ${contactTitle} at ${company}.

${rapportNotes ? `Rapport notes about this person:\n${rapportNotes}\n` : ''}
${additionalContext ? `Additional context: ${additionalContext}\n` : ''}

Requirements:
- Must be under 300 characters (hard LinkedIn limit)
- Reference something specific about them or their work
- Include a clear, genuine reason for connecting
- Sound natural and human, not like a template
- Be professional but warm`,

  follow_up: (contactName, contactTitle, company, rapportNotes, additionalContext, previousMessages) =>
    `Write a follow-up message to ${contactName} (${contactTitle} at ${company}) after they accepted your LinkedIn connection request.

${rapportNotes ? `Rapport notes about this person:\n${rapportNotes}\n` : ''}
${previousMessages ? `Previous messages exchanged:\n${previousMessages}\n` : ''}
${additionalContext ? `Additional context: ${additionalContext}\n` : ''}

Requirements:
- 2-4 sentences long
- Reference the context of your connection
- Suggest a specific next step (brief call, coffee chat, etc.)
- Sound warm and professional
- Don't be pushy or salesy`,

  thank_you: (contactName, contactTitle, company, rapportNotes, additionalContext, previousMessages) =>
    `Write a thank-you message to ${contactName} (${contactTitle} at ${company}).

${rapportNotes ? `Rapport notes about this person:\n${rapportNotes}\n` : ''}
${previousMessages ? `Previous messages exchanged:\n${previousMessages}\n` : ''}
${additionalContext ? `Additional context: ${additionalContext}\n` : ''}

Requirements:
- 2-3 sentences long
- Be specific about what you're thanking them for
- Express genuine gratitude
- Optionally mention how their help/time/advice was valuable
- Keep it concise and sincere`,

  check_in: (contactName, contactTitle, company, rapportNotes, additionalContext, previousMessages) =>
    `Write a check-in message to ${contactName} (${contactTitle} at ${company}) to maintain the professional relationship.

${rapportNotes ? `Rapport notes about this person:\n${rapportNotes}\n` : ''}
${previousMessages ? `Previous messages exchanged:\n${previousMessages}\n` : ''}
${additionalContext ? `Additional context: ${additionalContext}\n` : ''}

Requirements:
- 2-4 sentences long
- Reference something relevant (their recent work, industry news, shared interest)
- Feel natural, not forced or transactional
- Don't ask for anything directly -- just nurture the relationship
- Sound like a real person checking in, not a networking bot`,
};

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const {
      contactName,
      contactTitle,
      company,
      rapportNotes,
      messageType,
      previousMessages,
      additionalContext,
    } = body;
    const anthropicApiKey = body.anthropicApiKey || env.ANTHROPIC_API_KEY;

    if (!contactName) {
      return jsonResponse({ error: 'contactName is required' }, 400);
    }
    if (!company) {
      return jsonResponse({ error: 'company is required' }, 400);
    }
    if (!messageType) {
      return jsonResponse({ error: 'messageType is required' }, 400);
    }
    if (!anthropicApiKey) {
      return jsonResponse({ error: 'anthropicApiKey is required' }, 400);
    }

    const validTypes = ['connection', 'follow_up', 'thank_you', 'check_in'];
    if (!validTypes.includes(messageType)) {
      return jsonResponse(
        { error: `messageType must be one of: ${validTypes.join(', ')}` },
        400
      );
    }

    const promptBuilder = MESSAGE_PROMPTS[messageType];
    const prompt = promptBuilder(
      contactName,
      contactTitle || 'a professional',
      company,
      rapportNotes,
      additionalContext,
      previousMessages
    );

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nReturn ONLY the message text, no quotes, no explanation, no preamble.`,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const text = await anthropicResponse.text();
      return jsonResponse({ error: `Anthropic API error (${anthropicResponse.status}): ${text}` }, 502);
    }

    const anthropicData = await anthropicResponse.json();
    const message = anthropicData.content[0].text.trim();

    return jsonResponse({ message, messageType });
  } catch (err) {
    console.error('generate-message error:', err);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

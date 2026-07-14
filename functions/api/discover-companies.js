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

const COMPANY_DATASET_ID = 'gd_l1vikfnt1wgvvqz95w';

export async function onRequestPost(context) {
  try {
    const { request, env, data } = context;
    const body = await request.json();
    const { industries, country, region, companySizes, limit = 50 } = body;
    const brightDataApiKey = env.BRIGHT_DATA_API_KEY;
    const userId = data.user?.userId;

    // --- DIAGNOSTIC: return immediately to test if the function runs at all ---
    return jsonResponse({
      diagnostic: true,
      message: 'Function is reachable',
      hasApiKey: !!brightDataApiKey,
      userId: userId || 'none',
      receivedParams: { industries, country, region, companySizes, limit },
      companies: [],
      savedCount: 0,
      total: 0,
      alreadyExisted: 0,
    });
    // --- END DIAGNOSTIC ---
  } catch (err) {
    return jsonResponse({ error: err.message || 'Internal server error', stack: String(err.stack || '').slice(0, 500) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

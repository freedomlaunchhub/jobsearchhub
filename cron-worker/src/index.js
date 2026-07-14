const BASE_URL = 'https://job-search-hub.pages.dev';

function localHour(ts) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Edmonton',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(ts))
  );
}

async function runJobsPull(env) {
  const res = await fetch(`${BASE_URL}/api/cron/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text().catch(() => '');
  console.log(`Jobs pull: ${res.status} ${body.slice(0, 500)}`);
  return body;
}

// Processes the entire research queue: the endpoint handles a batch per
// call, so keep calling until it reports nothing remaining. The iteration
// guard is a platform-limit backstop, not a product cap — a queue too large
// for one night simply continues the next night.
async function runResearchQueue(env) {
  const log = [];
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${BASE_URL}/api/cron/research`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    if (!res.ok) {
      log.push(`batch ${i}: HTTP ${res.status}`);
      break;
    }
    const data = await res.json().catch(() => null);
    if (!data) break;
    log.push(`batch ${i}: processed ${data.processed}, remaining ${data.remaining}`);
    if (!data.remaining || data.processed === 0) break;
  }
  console.log(`Research queue: ${log.join(' | ')}`);
  return log.join('\n');
}

export default {
  async scheduled(event, env, ctx) {
    // Crons are UTC; both possible offsets per local hour are scheduled and
    // guarded here so runs stay at the same Calgary hour through MST/MDT.
    const hour = localHour(event.scheduledTime);

    if (hour === 7) {
      // 7:00 AM: pull all job postings from the past 24 hours
      ctx.waitUntil(runJobsPull(env));
    } else if (hour === 1) {
      // 1:00 AM: research every company queued during the day
      ctx.waitUntil(runResearchQueue(env));
    }
  },

  // Manual triggers for testing:
  //   GET /jobs      — run the jobs pull now
  //   GET /research  — process the research queue now
  async fetch(request, env) {
    if (request.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    const path = new URL(request.url).pathname;
    if (path === '/jobs') {
      return new Response(await runJobsPull(env), { headers: { 'Content-Type': 'application/json' } });
    }
    if (path === '/research') {
      return new Response(await runResearchQueue(env), { headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Use /jobs or /research', { status: 404 });
  },
};

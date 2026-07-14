const REFRESH_URL = 'https://job-search-hub.pages.dev/api/cron/refresh';

export default {
  async scheduled(event, env, ctx) {
    // Both 13:00 and 14:00 UTC are scheduled; only the one that is
    // 7 AM in Calgary actually runs (handles MST/MDT transitions).
    const localHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Edmonton',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(event.scheduledTime));

    if (Number(localHour) !== 7) return;

    ctx.waitUntil(
      fetch(REFRESH_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }).then(async (res) => {
        const body = await res.text().catch(() => '');
        console.log(`Daily refresh: ${res.status} ${body.slice(0, 500)}`);
      })
    );
  },

  // Manual trigger for testing: GET /run with the same bearer secret
  async fetch(request, env) {
    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    const res = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

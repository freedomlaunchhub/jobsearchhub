# Job Search Hub

A personal job search command center with AI-powered research. Two dashboards for job discovery/tracking and networking/Dream 100 company management.

## Tech Stack

- **Frontend:** Vite + React 18 + Tailwind CSS 3
- **Backend:** Cloudflare Pages Functions
- **Storage:** IndexedDB (client-side, works offline)
- **APIs:** Bright Data (web scraping), Anthropic Claude (AI analysis)

## Development

```bash
npm install
npm run dev
```

## Deployment

Connect the GitHub repo to Cloudflare Pages:
- Build command: `npm run build`
- Build output: `dist`
- Set `BRIGHT_DATA_API_KEY` and `ANTHROPIC_API_KEY` as environment variables

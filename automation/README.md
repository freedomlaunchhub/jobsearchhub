# LinkedIn Jobs Daily Digest

Automated daily job search that pulls Project Manager listings from LinkedIn and delivers them to multiple destinations.

## How it works

A Claude Code **Routine** fires every morning at 7 AM ET (11:00 UTC). Each run:

1. **Fetches** Project Manager job listings in Canada from LinkedIn via Bright Data
2. **Saves** each job to a Notion database ("LinkedIn Job Listings") with tracking columns
3. **Updates** `public/data/daily-jobs.json` in the repo so the Job Search Hub app can import them
4. **Sends** a push notification to your phone with a summary

## Configuration

Edit `config.json` to change:
- **keywords** — job titles to search for
- **location** — geographic filter
- **linkedin_search_url** — the LinkedIn search URL (includes `f_TPR=r86400` for last-24-hours filter)

## Managing the Routine

The Routine is managed via Claude Code. To modify the schedule, search terms, or delivery method, ask Claude to update the Routine.

## App Integration

The Job Search Hub app automatically imports jobs from `public/data/daily-jobs.json` during its daily refresh. Jobs appear in the dashboard with source `linkedin-digest` and can be tracked through the Kanban pipeline like any other job.

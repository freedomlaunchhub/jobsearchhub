# Contact Search Criteria

The single source of truth for who gets pulled as a networking contact.
Implemented in `functions/api/find-contacts.js` (button) and
`functions/api/cron/research.js` (nightly queue run) — both must behave
identically.

## Search scope (Bright Data people dataset)

- Current employer = the target company (exact name match preferred over
  substring matches)
- `country_code` = the user's discovery country from Settings
- Profile mentions at least one role keyword (API prefilter; the user's
  target job titles are appended when not already covered, max 13 phrases —
  more phrases cause Bright Data timeouts)
- Up to 25 candidates fetched per search

## Judgment — on the actual current job title

Each candidate is judged by their current job title at that company,
extracted from the profile's experience section. The `position` headline is
free-form marketing text and is only used as a trimmed fallback. Grouped
experience entries use the company name as the entry title — never treat
that as a job title.

### 1. Exclusions (checked first, absolute)

Titles containing any of: student recruitment, international recruitment,
admissions, enrollment, sales, account management / account executive /
account support / account director, customer, client relations, business
development, marketing.

Rationale: these either recruit customers/students (not employees) or don't
hire for the user's target roles. This is what keeps "Recruiter" at an
edtech (student recruitment) out of the results.

### 2. Role groups (kept, ranked in this order)

1. **Hiring managers** — Senior Manager, Director, Head, VP, Vice President
2. **Relevant professionals** — Project Manager, Program Manager, Business Analyst
3. **Recruiters** — Recruiter, Talent Acquisition, Talent Partner
4. **Peers** — title matches one of the user's target job titles (Settings)

Anyone matching no group is discarded.

### 3. AI screen (final pass)

One `claude-haiku-4-5` call per research action reviews the surviving titles
and drops ambiguous ones. Fail-open: if the call errors, the deterministic
result stands. Cost ≈ $0.001 per action.

## Saved contact fields

name, current title, company, location, LinkedIn URL, connection status
(`identified`), empty notes. Deduplicated against existing contacts by
LinkedIn URL, then by name+company.

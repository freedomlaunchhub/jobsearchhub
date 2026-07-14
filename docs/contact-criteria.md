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

### 1. Exclusions (checked first)

The ONLY absolute exclusions are clear seniority markers — junior roles:
intern, trainee, fresher, junior, entry level, co-op, coordinator,
assistant, student.

There are NO blanket bans on functions (sales, customer, etc.). Whether a
function is related to the user's target roles is contextual and decided by
the AI screen (step 3) — e.g. "Recruitment Manager" at an edtech recruits
students, not employees, and gets discarded there, while a Director in an
adjacent function may still be a plausible hiring manager.

### 2. Role groups (kept, ranked in this order)

1. **Hiring managers** — Senior Manager, Director, Head, VP, Vice President
2. **Relevant professionals** — Project Manager, Program Manager, Business Analyst
3. **Recruiters** — Recruiter, Talent Acquisition, Talent Partner
4. **Peers** — title matches one of the user's target job titles (Settings)

Anyone matching no group is discarded.

### 3. AI screen (final pass — contextual relevance)

One `claude-haiku-4-5` call per research action reviews the surviving titles
against the user's target roles and discards junior or unrelated ones by
judgment, not fixed rules (student/customer recruitment ≠ talent
acquisition; unrelated functions with no hiring relevance are dropped).
Fail-open: if the call errors, the deterministic result stands.
Cost ≈ $0.001 per action.

## Saved contact fields

name, current title, company, location, LinkedIn URL, connection status
(`identified`), empty notes. Deduplicated against existing contacts by
LinkedIn URL, then by name+company.

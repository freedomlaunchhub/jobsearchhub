const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Jobs: DB row (snake_case) ↔ API object (camelCase)
export function deserializeJob(row) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    remote: Boolean(row.remote),
    source: row.source,
    sourceUrl: row.source_url,
    postedDate: row.posted_date,
    description: row.description,
    salaryRange: row.salary_range,
    requirements: JSON.parse(row.requirements || '[]'),
    status: row.status,
    statusHistory: JSON.parse(row.status_history || '[]'),
    notes: row.notes,
    appliedDate: row.applied_date,
    createdAt: row.created_at,
  };
}

export function serializeJob(job, userId) {
  return {
    id: job.id,
    user_id: userId,
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote ? 1 : 0,
    source: job.source,
    source_url: job.sourceUrl,
    posted_date: job.postedDate,
    description: job.description,
    salary_range: job.salaryRange,
    requirements: JSON.stringify(job.requirements || []),
    status: job.status,
    status_history: JSON.stringify(job.statusHistory || []),
    notes: job.notes,
    applied_date: job.appliedDate,
    created_at: job.createdAt,
  };
}

// Companies: DB row ↔ API object
export function deserializeCompany(row) {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    website: row.website,
    careersUrl: row.careers_url,
    linkedinUrl: row.linkedin_url,
    size: row.size,
    priority: row.priority,
    status: row.status,
    whyDream: row.why_dream,
    notes: row.notes,
    contactCount: row.contact_count,
    createdAt: row.created_at,
  };
}

export function serializeCompany(company, userId) {
  return {
    id: company.id,
    user_id: userId,
    name: company.name,
    industry: company.industry || '',
    website: company.website || '',
    careers_url: company.careersUrl || '',
    linkedin_url: company.linkedinUrl || '',
    size: company.size || '',
    priority: company.priority || 'medium',
    status: company.status || 'new',
    why_dream: company.whyDream || '',
    notes: company.notes || '',
    contact_count: company.contactCount || 0,
    created_at: company.createdAt,
  };
}

// Contacts: DB row ↔ API object
export function deserializeContact(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    name: row.name,
    title: row.title,
    linkedinUrl: row.linkedin_url,
    location: row.location || '',
    otherSocial: JSON.parse(row.other_social || '[]'),
    rapportNotes: row.rapport_notes,
    connectionStatus: row.connection_status,
    connectionDate: row.connection_date,
    lastContactDate: row.last_contact_date,
    nextFollowupDate: row.next_followup_date,
    messageDrafts: JSON.parse(row.message_drafts || '[]'),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function serializeContact(contact, userId) {
  return {
    id: contact.id,
    user_id: userId,
    company_id: contact.companyId,
    company_name: contact.companyName || '',
    name: contact.name,
    title: contact.title || '',
    linkedin_url: contact.linkedinUrl || '',
    location: contact.location || '',
    other_social: JSON.stringify(contact.otherSocial || []),
    rapport_notes: contact.rapportNotes || '',
    connection_status: contact.connectionStatus || 'identified',
    connection_date: contact.connectionDate,
    last_contact_date: contact.lastContactDate,
    next_followup_date: contact.nextFollowupDate,
    message_drafts: JSON.stringify(contact.messageDrafts || []),
    notes: contact.notes || '',
    created_at: contact.createdAt,
  };
}

// Settings: DB row ↔ API object
export function deserializeSettings(row) {
  return {
    id: 'config',
    jobTitles: JSON.parse(row.job_titles || '[]'),
    location: row.location || '',
    remoteIncluded: Boolean(row.remote_included),
    jobSources: JSON.parse(row.job_sources || '[]'),
    dailyTarget: row.daily_target || 5,
    streak: {
      current: row.streak_current || 0,
      longest: row.streak_longest || 0,
      lastActiveDate: row.last_active_date || '',
    },
    preferredIndustries: JSON.parse(row.preferred_industries || '[]'),
    preferredCompanySizes: JSON.parse(row.preferred_company_sizes || '[]'),
    discoveryCountry: row.discovery_country || 'CA',
    discoveryLocation: row.discovery_location || '',
    lastDailyRefresh: row.last_daily_refresh || '',
  };
}

// Daily logs: DB row ↔ API object
export function deserializeDailyLog(row) {
  return {
    date: row.date,
    applicationsCount: row.applications_count || 0,
    connectionsSent: row.connections_sent || 0,
    followupsDone: row.followups_done || 0,
    jobsReviewed: row.jobs_reviewed || 0,
    notes: row.notes || '',
  };
}

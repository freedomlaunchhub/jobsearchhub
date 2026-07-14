import { format, subDays } from 'date-fns'
import { getDB } from '@/db/connection'
import type { Company, Contact, Job, DailyLog } from '@/db/schema'

let seeded = false

export async function seedIfEmpty(): Promise<void> {
  if (seeded) return
  seeded = true

  const db = await getDB()
  const existingCount = await db.count('companies')
  if (existingCount > 0) return

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')

  // --- Sample companies ---

  const suncorId = crypto.randomUUID()
  const tcEnergyId = crypto.randomUUID()
  const shawId = crypto.randomUUID()
  const westjetId = crypto.randomUUID()
  const benevityId = crypto.randomUUID()
  const helcimId = crypto.randomUUID()
  const attaboticsId = crypto.randomUUID()
  const neoId = crypto.randomUUID()
  const shopifyId = crypto.randomUUID()
  const atcoId = crypto.randomUUID()

  const companies: Company[] = [
    {
      id: suncorId,
      name: 'Suncor Energy',
      industry: 'Oil & Gas',
      website: 'https://www.suncor.com',
      careersUrl: 'https://www.suncor.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/suncor-energy',
      size: 'Enterprise',
      priority: 'high',
      status: 'researching',
      whyDream: 'Major Calgary employer with large-scale transformation initiatives and strong PM culture.',
      notes: '',
      contactCount: 2,
      createdAt: subDays(now, 12).toISOString(),
    },
    {
      id: tcEnergyId,
      name: 'TC Energy',
      industry: 'Energy',
      website: 'https://www.tcenergy.com',
      careersUrl: 'https://www.tcenergy.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/tc-energy',
      size: 'Enterprise',
      priority: 'high',
      status: 'networking',
      whyDream: 'Global energy infrastructure company with significant project portfolios.',
      notes: '',
      contactCount: 0,
      createdAt: subDays(now, 11).toISOString(),
    },
    {
      id: shawId,
      name: 'Shaw Communications',
      industry: 'Telecom',
      website: 'https://www.shaw.ca',
      careersUrl: 'https://www.shaw.ca/careers',
      linkedinUrl: 'https://www.linkedin.com/company/shaw-communications',
      size: 'Large',
      priority: 'medium',
      status: 'researching',
      whyDream: 'Calgary-based telecom with ongoing digital transformation programs.',
      notes: '',
      contactCount: 0,
      createdAt: subDays(now, 10).toISOString(),
    },
    {
      id: westjetId,
      name: 'WestJet',
      industry: 'Airlines',
      website: 'https://www.westjet.com',
      careersUrl: 'https://www.westjet.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/westjet',
      size: 'Large',
      priority: 'medium',
      status: 'applied',
      whyDream: 'Calgary HQ airline undergoing fleet and tech modernization.',
      notes: '',
      contactCount: 0,
      createdAt: subDays(now, 9).toISOString(),
    },
    {
      id: benevityId,
      name: 'Benevity',
      industry: 'Tech / CSR',
      website: 'https://www.benevity.com',
      careersUrl: 'https://www.benevity.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/benevity',
      size: 'Medium',
      priority: 'high',
      status: 'networking',
      whyDream: 'Leading social-impact tech platform based in Calgary with strong product culture.',
      notes: '',
      contactCount: 0,
      createdAt: subDays(now, 8).toISOString(),
    },
    {
      id: helcimId,
      name: 'Helcim',
      industry: 'Fintech',
      website: 'https://www.helcim.com',
      careersUrl: 'https://www.helcim.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/helcim',
      size: 'Small',
      priority: 'medium',
      status: 'researching',
      whyDream: 'Fast-growing Calgary fintech with transparent culture and product-led growth.',
      notes: '',
      contactCount: 0,
      createdAt: subDays(now, 7).toISOString(),
    },
    {
      id: attaboticsId,
      name: 'Attabotics',
      industry: 'Robotics',
      website: 'https://www.attabotics.com',
      careersUrl: 'https://www.attabotics.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/attabotics',
      size: 'Medium',
      priority: 'low',
      status: 'researching',
      whyDream: 'Calgary robotics innovator reinventing warehouse automation.',
      notes: '',
      contactCount: 0,
      createdAt: subDays(now, 6).toISOString(),
    },
    {
      id: neoId,
      name: 'Neo Financial',
      industry: 'Fintech',
      website: 'https://www.neofinancial.com',
      careersUrl: 'https://www.neofinancial.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/neo-financial',
      size: 'Medium',
      priority: 'high',
      status: 'interviewing',
      whyDream: 'High-growth Calgary fintech disrupting traditional banking with agile teams.',
      notes: 'Had initial phone screen last week.',
      contactCount: 1,
      createdAt: subDays(now, 14).toISOString(),
    },
    {
      id: shopifyId,
      name: 'Shopify',
      industry: 'Tech (Remote)',
      website: 'https://www.shopify.com',
      careersUrl: 'https://www.shopify.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/shopify',
      size: 'Enterprise',
      priority: 'medium',
      status: 'networking',
      whyDream: 'Remote-first Canadian tech leader with world-class product organization.',
      notes: '',
      contactCount: 0,
      createdAt: subDays(now, 5).toISOString(),
    },
    {
      id: atcoId,
      name: 'ATCO',
      industry: 'Utilities',
      website: 'https://www.atco.com',
      careersUrl: 'https://www.atco.com/careers',
      linkedinUrl: 'https://www.linkedin.com/company/atco',
      size: 'Enterprise',
      priority: 'low',
      status: 'researching',
      whyDream: 'Calgary-based utilities conglomerate with large project portfolios.',
      notes: '',
      contactCount: 0,
      createdAt: subDays(now, 4).toISOString(),
    },
  ]

  // --- Sample contacts ---

  const contacts: Contact[] = [
    {
      id: crypto.randomUUID(),
      companyId: suncorId,
      companyName: 'Suncor Energy',
      name: 'Sarah Chen',
      title: 'VP Product',
      linkedinUrl: 'https://www.linkedin.com/in/sarahchen',
      otherSocial: [],
      rapportNotes: 'Spoke at Calgary Product Meetup in March. Passionate about sustainable energy tech.',
      connectionStatus: 'identified',
      connectionDate: null,
      lastContactDate: null,
      nextFollowupDate: null,
      messageDrafts: [],
      notes: '',
      createdAt: subDays(now, 10).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      companyId: suncorId,
      companyName: 'Suncor Energy',
      name: 'Michael Torres',
      title: 'Director PMO',
      linkedinUrl: 'https://www.linkedin.com/in/michaeltorres',
      otherSocial: [],
      rapportNotes: 'Connected through PMAC Calgary chapter.',
      connectionStatus: 'message_sent',
      connectionDate: null,
      lastContactDate: subDays(now, 3).toISOString(),
      nextFollowupDate: format(subDays(now, -4), 'yyyy-MM-dd'),
      messageDrafts: ['Hi Michael, I enjoyed your talk at the PMAC event. Would love to connect and learn more about the transformation work at Suncor.'],
      notes: '',
      createdAt: subDays(now, 8).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      companyId: neoId,
      companyName: 'Neo Financial',
      name: 'Priya Sharma',
      title: 'Head of Product',
      linkedinUrl: 'https://www.linkedin.com/in/priyasharma',
      otherSocial: [],
      rapportNotes: 'Met at Startup Calgary event. Interested in change management for scaling teams.',
      connectionStatus: 'connected',
      connectionDate: subDays(now, 7).toISOString(),
      lastContactDate: subDays(now, 2).toISOString(),
      nextFollowupDate: format(subDays(now, -5), 'yyyy-MM-dd'),
      messageDrafts: [],
      notes: 'Referred me to the PM role posting.',
      createdAt: subDays(now, 9).toISOString(),
    },
  ]

  // --- Sample jobs ---

  const jobs: Job[] = [
    {
      id: crypto.randomUUID(),
      title: 'Senior Product Manager',
      company: 'WestJet',
      location: 'Calgary, AB',
      remote: false,
      source: 'linkedin',
      sourceUrl: 'https://www.linkedin.com/jobs/view/example1',
      postedDate: subDays(now, 5).toISOString(),
      description: 'Lead product strategy for WestJet digital booking experience. Partner with engineering, design, and airline operations teams.',
      salaryRange: '$110,000 - $140,000',
      requirements: ['5+ years product management', 'Agile experience', 'Stakeholder management'],
      status: 'applied',
      statusHistory: [
        { status: 'new', date: subDays(now, 5).toISOString() },
        { status: 'saved', date: subDays(now, 4).toISOString() },
        { status: 'applied', date: subDays(now, 2).toISOString() },
      ],
      notes: 'Applied through LinkedIn Easy Apply. Tailored resume to emphasize airline/travel tech experience.',
      appliedDate: subDays(now, 2).toISOString(),
      createdAt: subDays(now, 5).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: 'Change Management Lead',
      company: 'Suncor Energy',
      location: 'Calgary, AB',
      remote: false,
      source: 'company_careers',
      sourceUrl: 'https://www.suncor.com/careers/example2',
      postedDate: subDays(now, 3).toISOString(),
      description: 'Drive organizational change for enterprise-wide ERP migration. Lead stakeholder engagement and training programs.',
      salaryRange: '$120,000 - $150,000',
      requirements: ['Prosci certification', 'Change management experience', 'ERP implementation'],
      status: 'saved',
      statusHistory: [
        { status: 'new', date: subDays(now, 3).toISOString() },
        { status: 'saved', date: subDays(now, 2).toISOString() },
      ],
      notes: 'Great fit for change management background. Michael Torres might be the hiring manager.',
      appliedDate: null,
      createdAt: subDays(now, 3).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: 'Product Manager',
      company: 'Neo Financial',
      location: 'Calgary, AB',
      remote: true,
      source: 'linkedin',
      sourceUrl: 'https://www.linkedin.com/jobs/view/example3',
      postedDate: subDays(now, 7).toISOString(),
      description: 'Own the roadmap for Neo Financial consumer banking products. Work closely with engineering and data teams in a fast-paced startup environment.',
      salaryRange: '$100,000 - $130,000',
      requirements: ['3+ years product management', 'Fintech or banking experience', 'Data-driven decision making'],
      status: 'interview',
      statusHistory: [
        { status: 'new', date: subDays(now, 7).toISOString() },
        { status: 'saved', date: subDays(now, 6).toISOString() },
        { status: 'applied', date: subDays(now, 5).toISOString() },
        { status: 'interview', date: subDays(now, 1).toISOString() },
      ],
      notes: 'Priya Sharma referred me. First interview scheduled.',
      appliedDate: subDays(now, 5).toISOString(),
      createdAt: subDays(now, 7).toISOString(),
    },
  ]

  // --- Sample daily log ---

  const dailyLog: DailyLog = {
    date: today,
    applicationsCount: 1,
    connectionsSent: 2,
    followupsDone: 1,
    jobsReviewed: 5,
    notes: 'Reviewed several new PM postings. Sent connection requests to two people at Benevity.',
  }

  // --- Insert everything ---

  const tx = db.transaction(['companies', 'contacts', 'jobs', 'dailyLogs'], 'readwrite')

  for (const company of companies) {
    tx.objectStore('companies').put(company)
  }
  for (const contact of contacts) {
    tx.objectStore('contacts').put(contact)
  }
  for (const job of jobs) {
    tx.objectStore('jobs').put(job)
  }
  tx.objectStore('dailyLogs').put(dailyLog)

  await tx.done
}

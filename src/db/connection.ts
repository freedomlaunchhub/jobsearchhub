import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'job-search-hub'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1→v2: clear seed/fake data from all stores
        if (oldVersion === 1) {
          for (const name of Array.from(db.objectStoreNames)) {
            db.deleteObjectStore(name)
          }
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('jobs')) {
          const jobStore = db.createObjectStore('jobs', { keyPath: 'id' })
          jobStore.createIndex('by-status', 'status')
          jobStore.createIndex('by-company', 'company')
          jobStore.createIndex('by-createdAt', 'createdAt')
        }

        if (!db.objectStoreNames.contains('companies')) {
          const companyStore = db.createObjectStore('companies', { keyPath: 'id' })
          companyStore.createIndex('by-priority', 'priority')
          companyStore.createIndex('by-status', 'status')
          companyStore.createIndex('by-name', 'name')
        }

        if (!db.objectStoreNames.contains('contacts')) {
          const contactStore = db.createObjectStore('contacts', { keyPath: 'id' })
          contactStore.createIndex('by-companyId', 'companyId')
          contactStore.createIndex('by-connectionStatus', 'connectionStatus')
          contactStore.createIndex('by-nextFollowupDate', 'nextFollowupDate')
        }

        if (!db.objectStoreNames.contains('dailyLogs')) {
          db.createObjectStore('dailyLogs', { keyPath: 'date' })
        }
      },
    })
  }
  return dbPromise
}

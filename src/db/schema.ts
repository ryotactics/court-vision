import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ProjectData } from '../types'

interface CourtVisionDB extends DBSchema {
  projects: {
    key: string
    value: ProjectData
  }
}

export const dbPromise: Promise<IDBPDatabase<CourtVisionDB>> =
  openDB<CourtVisionDB>('court-vision-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
    },
  })

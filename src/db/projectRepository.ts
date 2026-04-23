import { dbPromise } from './schema'
import type { ProjectData } from '../types'

export const upsertProject = async (project: ProjectData) => {
  const db = await dbPromise
  await db.put('projects', project)
}

export const getProject = async (id: string) => {
  const db = await dbPromise
  return db.get('projects', id)
}

export const listProjects = async () => {
  const db = await dbPromise
  const projects = await db.getAll('projects')
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const deleteProject = async (id: string) => {
  const db = await dbPromise
  await db.delete('projects', id)
}

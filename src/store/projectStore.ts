import { create } from 'zustand'
import type {
  Annotation,
  ClipRange,
  Marker,
  ProjectData,
  SaveStatus,
} from '../types'

type ProjectStore = {
  project: ProjectData | null
  saveStatus: SaveStatus
  setProject: (project: ProjectData) => void
  updateMarkers: (markers: Marker[]) => void
  updateClips: (clips: ClipRange[]) => void
  updateAnnotations: (annotations: Annotation[]) => void
  setSaveStatus: (saveStatus: SaveStatus) => void
}

const updateProject = (
  project: ProjectData | null,
  patch: Partial<ProjectData>,
): ProjectData | null =>
  project ? { ...project, ...patch, updatedAt: Date.now() } : project

const normalizeProject = (project: ProjectData): ProjectData => ({
  ...project,
  teams: Array.isArray(project.teams) ? project.teams : [],
})

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  saveStatus: 'idle',
  setProject: (project) => set({ project: normalizeProject(project), saveStatus: 'idle' }),
  updateMarkers: (markers) =>
    set((state) => ({
      project: updateProject(state.project, { markers }),
      saveStatus: 'idle',
    })),
  updateClips: (clips) =>
    set((state) => ({
      project: updateProject(state.project, { clips }),
      saveStatus: 'idle',
    })),
  updateAnnotations: (annotations) =>
    set((state) => ({
      project: updateProject(state.project, { annotations }),
      saveStatus: 'idle',
    })),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
}))

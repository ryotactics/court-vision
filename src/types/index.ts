export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type Marker = {
  id: string
  time: number
  label: string
  color: string
}

export type ClipTags = {
  team: string | null
  phase: 'O' | 'D' | null
  error: boolean
  players: string[]
}

export type ClipRange = {
  id: string
  start: number
  end: number
  label: string
  name: string
  tags: ClipTags
}

export type Annotation = {
  id: string
  time: number
  points: { x: number; y: number }[]
  color: string
}

export type ProjectData = {
  id: string
  name: string
  videoFileName: string
  duration: number
  teams: string[]
  markers: Marker[]
  clips: ClipRange[]
  annotations: Annotation[]
  updatedAt: number
}

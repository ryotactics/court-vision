import { useEffect, useRef } from 'react'
import { upsertProject } from '../db/projectRepository'
import { useProjectStore } from '../store/projectStore'
import type { ProjectData } from '../types'

export const useAutoSave = (project: ProjectData | null) => {
  const timerRef = useRef<number | null>(null)
  const saveStatus = useProjectStore((state) => state.saveStatus)
  const setSaveStatus = useProjectStore((state) => state.setSaveStatus)

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    if (!project) {
      return () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
        }
      }
    }

    timerRef.current = window.setTimeout(() => {
      setSaveStatus('saving')
      void upsertProject(project)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 500)

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [project, setSaveStatus])

  return saveStatus
}

import { useEffect, useRef, useState } from 'react'
import './App.css'
import { AnnotationCanvas } from './components/AnnotationCanvas/AnnotationCanvas'
import { FileImporter } from './components/FileImporter/FileImporter'
import { SaveIndicator } from './components/SaveIndicator/SaveIndicator'
import { Timeline } from './components/Timeline/Timeline'
import { VideoPlayer } from './components/VideoPlayer/VideoPlayer'
import { useAutoSave } from './hooks/useAutoSave'
import { useFileSystemAccess } from './hooks/useFileSystemAccess'
import { useVideoFile } from './hooks/useVideoFile'
import { useProjectStore } from './store/projectStore'
import type { Annotation, ClipRange, Marker, ProjectData } from './types'

const createProject = (file: File): ProjectData => ({
  id: crypto.randomUUID(),
  name: file.name.replace(/\.[^.]+$/, '') || file.name,
  videoFileName: file.name,
  duration: 0,
  markers: [],
  clips: [],
  annotations: [],
  updatedAt: Date.now(),
})

const fmt = (s: number) => {
  const t = Math.max(0, s)
  const m = Math.floor(t / 60)
  const sec = Math.floor(t % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 })
  const [editingClipId, setEditingClipId] = useState<string | null>(null)
  const [clipLabelDraft, setClipLabelDraft] = useState('')
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null)
  const videoStageRef = useRef<HTMLDivElement | null>(null)

  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const updateMarkers = useProjectStore((s) => s.updateMarkers)
  const updateClips = useProjectStore((s) => s.updateClips)
  const updateAnnotations = useProjectStore((s) => s.updateAnnotations)

  const { url } = useVideoFile(videoFile)
  const saveStatus = useAutoSave(project)
  const { openFile } = useFileSystemAccess()

  useEffect(() => {
    const stage = videoStageRef.current
    if (!stage) return
    const update = () => {
      const b = stage.getBoundingClientRect()
      setCanvasSize({ width: Math.max(1, Math.round(b.width)), height: Math.max(1, Math.round(b.height)) })
    }
    update()
    const obs = new ResizeObserver(update)
    obs.observe(stage)
    return () => obs.disconnect()
  }, [url])

  const handleFile = (file: File) => {
    setVideoFile(file)
    setCurrentTime(0)
    setProject(createProject(file))
  }

  const setDuration = (duration: number) => {
    if (!project) return
    setProject({ ...project, duration, updatedAt: Date.now() })
  }

  const seek = (time: number) => {
    const t = Math.max(0, Math.min(time, project?.duration ?? time))
    setCurrentTime(t)
    if (videoPlayerRef.current) videoPlayerRef.current.currentTime = t
  }

  const addMarker = () => {
    if (!project) return
    const marker: Marker = {
      id: crypto.randomUUID(),
      time: currentTime,
      label: `M${project.markers.length + 1}`,
      color: '#a78bfa',
    }
    updateMarkers([...project.markers, marker].sort((a, b) => a.time - b.time))
  }

  const addClip = () => {
    if (!project) return
    const clip: ClipRange = {
      id: crypto.randomUUID(),
      start: Math.max(0, currentTime - 5),
      end: Math.min(project.duration, currentTime + 5),
      label: `Clip ${project.clips.length + 1}`,
    }
    updateClips([...project.clips, clip].sort((a, b) => a.start - b.start))
  }

  const addAnnotation = (annotation: Annotation) => {
    if (!project) return
    updateAnnotations([...project.annotations, annotation])
  }

  const startClipLabelEdit = (clip: ClipRange) => {
    setEditingClipId(clip.id)
    setClipLabelDraft(clip.label)
  }

  const saveClipLabel = (clipId: string) => {
    if (!project) return
    const label = clipLabelDraft.trim()
    updateClips(project.clips.map((clip) => (
      clip.id === clipId ? { ...clip, label: label || clip.label } : clip
    )))
    setEditingClipId(null)
    setClipLabelDraft('')
  }

  const deleteClip = (clipId: string) => {
    if (!project) return
    updateClips(project.clips.filter((clip) => clip.id !== clipId))
    if (editingClipId === clipId) {
      setEditingClipId(null)
      setClipLabelDraft('')
    }
  }

  const selectedClipId = project?.clips.find((clip) => (
    currentTime >= clip.start && currentTime <= clip.end
  ))?.id

  return (
    <div className="app-shell">

      {/* ── Titlebar ── */}
      <header className="titlebar">
        <div className="titlebar-brand">
          <svg className="titlebar-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
            <polygon points="12,7 17,10 17,14 12,17 7,14 7,10" opacity=".5" />
            <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
          </svg>
          <span className="titlebar-appname">Court Vision</span>
        </div>

        {project && (
          <>
            <div className="titlebar-sep" />
            <span className="titlebar-filename">{project.videoFileName}</span>
          </>
        )}

        <div className="titlebar-actions">
          <SaveIndicator status={saveStatus} />
        </div>
      </header>

      {/* ── Editor ── */}
      <div className="editor">

        {/* Main area: left panel | viewer | right panel */}
        <div className="main-area">

          {/* Left panel */}
          <aside className="panel panel--left">
            <div className="panel-section">
              <div className="panel-header">Project</div>
              <div className="panel-body">
                {project ? (
                  <dl className="metadata-list">
                    <div><dt>File</dt><dd title={project.videoFileName}>{project.videoFileName}</dd></div>
                    <div><dt>Duration</dt><dd>{fmt(project.duration)}</dd></div>
                  </dl>
                ) : (
                  <span className="panel-empty">No project open</span>
                )}
              </div>
            </div>

            <div className="panel-section panel-section--clips">
              <div className="panel-header">Clips</div>
              <div className="panel-body panel-body--clips">
                {project?.clips.length ? (
                  <div className="clip-list">
                    {project.clips.map((clip) => (
                      <div
                        className={`clip-row${selectedClipId === clip.id ? ' clip-row--selected' : ''}`}
                        key={clip.id}
                        onClick={() => seek(clip.start)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') seek(clip.start)
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="clip-row__main">
                          {editingClipId === clip.id ? (
                            <input
                              autoFocus
                              className="clip-row__input"
                              value={clipLabelDraft}
                              onBlur={() => saveClipLabel(clip.id)}
                              onChange={(event) => setClipLabelDraft(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                event.stopPropagation()
                                if (event.key === 'Enter') saveClipLabel(clip.id)
                                if (event.key === 'Escape') {
                                  setEditingClipId(null)
                                  setClipLabelDraft('')
                                }
                              }}
                            />
                          ) : (
                            <span
                              className="clip-row__label"
                              onClick={(event) => {
                                event.stopPropagation()
                                startClipLabelEdit(clip)
                              }}
                              title={clip.label}
                            >
                              {clip.label}
                            </span>
                          )}
                          <span className="clip-row__range">
                            {fmt(clip.start)} &rarr; {fmt(clip.end)}
                          </span>
                        </div>
                        <span className="clip-row__duration">{Math.round(Math.max(0, clip.end - clip.start))}s</span>
                        <button
                          className="clip-row__delete"
                          aria-label={`Delete ${clip.label}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            deleteClip(clip.id)
                          }}
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="panel-empty">Add Clip to get started</span>
                )}
              </div>
            </div>
          </aside>

          {/* Viewer */}
          <div className="viewer">
            {url && project ? (
              <div className="video-stage" ref={videoStageRef}>
                <VideoPlayer
                  src={url}
                  onDurationChange={setDuration}
                  onTimeUpdate={setCurrentTime}
                  playerRef={videoPlayerRef}
                />
                <AnnotationCanvas
                  width={canvasSize.width}
                  height={canvasSize.height}
                  currentTime={currentTime}
                  annotations={project.annotations}
                  onAddAnnotation={addAnnotation}
                />
              </div>
            ) : (
              <FileImporter onFile={handleFile} onOpenFile={openFile} />
            )}
          </div>

          {/* Right panel */}
          <aside className="panel panel--right">
            <div className="panel-header">Tools</div>
            <div className="panel-body">
              <button className="btn-primary btn-block" onClick={addMarker} disabled={!project}>
                Add Marker
              </button>
              <button className="btn-block" onClick={addClip} disabled={!project}>
                Add Clip
              </button>
            </div>
          </aside>

        </div>

        {/* Timeline dock */}
        <div className="timeline-dock">
          <div className="timeline-dock-header">
            <span className="timeline-dock-title">Timeline</span>
            {project && (
              <span className="timeline-dock-time">
                {fmt(currentTime)} / {fmt(project.duration)}
              </span>
            )}
          </div>
          <div className="timeline-inner">
            <Timeline
              duration={project?.duration ?? 0}
              currentTime={currentTime}
              markers={project?.markers ?? []}
              clips={project?.clips ?? []}
              onSeek={seek}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

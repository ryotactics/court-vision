import { useEffect, useRef, useState } from 'react'
import './App.css'
import { AnnotationCanvas } from './components/AnnotationCanvas/AnnotationCanvas'
import { FileImporter } from './components/FileImporter/FileImporter'
import { SaveIndicator } from './components/SaveIndicator/SaveIndicator'
import { Timeline } from './components/Timeline/Timeline'
import { VideoPlayer } from './components/VideoPlayer/VideoPlayer'
import { useAutoSave } from './hooks/useAutoSave'
import { useFfmpeg } from './hooks/useFfmpeg'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useProjectStore } from './store/projectStore'
import type { Annotation, ClipRange, ClipTags, Marker, ProjectData } from './types'
import { generateClipLabel } from './utils/clipLabel'

const defaultClipTags: ClipTags = { team: null, phase: null, error: false, players: [] }
const zoomLevels = [1, 2, 5, 10, 20]

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const normalizeClipTags = (tags?: Partial<ClipTags>): ClipTags => ({
  team: typeof tags?.team === 'string' && tags.team.trim() ? tags.team : null,
  phase: tags?.phase === 'O' || tags?.phase === 'D' ? tags.phase : null,
  error: Boolean(tags?.error),
  players: Array.isArray(tags?.players) ? tags.players : [],
})

function TeamAddInput({ onAdd }: { onAdd: (teamName: string) => void }) {
  const [draft, setDraft] = useState('')

  const submit = () => {
    const teamName = draft.trim()
    if (!teamName) return
    onAdd(teamName)
    setDraft('')
  }

  return (
    <div className="team-add-row">
      <input
        className="team-add-input"
        aria-label="Add team name"
        autoComplete="off"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="Team name"
      />
      <button
        className="team-add-btn"
        type="button"
        aria-label="Add team"
        onClick={submit}
      >
        +
      </button>
    </div>
  )
}

const createProject = (file: File): ProjectData => ({
  id: crypto.randomUUID(),
  name: file.name.replace(/\.[^.]+$/, '') || file.name,
  videoFileName: file.name,
  duration: 0,
  teams: [],
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
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 })
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null)
  const [playerDraft, setPlayerDraft] = useState('')
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false)
  const [preRollSec, setPreRollSec] = useState(10)
  const [postRollSec, setPostRollSec] = useState(5)
  const [playingClipId, setPlayingClipId] = useState<string | null>(null)
  const [isClipPaused, setIsClipPaused] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [zoomStart, setZoomStart] = useState(0)
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null)
  const videoStageRef = useRef<HTMLDivElement | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const updateMarkers = useProjectStore((s) => s.updateMarkers)
  const updateClips = useProjectStore((s) => s.updateClips)
  const updateAnnotations = useProjectStore((s) => s.updateAnnotations)

  const saveStatus = useAutoSave(project)
  const ffmpeg = useFfmpeg()

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

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
  }, [videoUrl])

  useEffect(() => {
    if (!isKeyboardHelpOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsKeyboardHelpOpen(false)
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isKeyboardHelpOpen])

  const handleFile = (file: File, url: string) => {
    setVideoUrl(url)
    setVideoFile(file)
    setCurrentTime(0)
    setPlayingClipId(null)
    setIsClipPaused(false)
    setZoomLevel(1)
    setZoomStart(0)
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

    if (!playingClipId || !project) return

    const playingClip = project.clips.find((clip) => clip.id === playingClipId)
    if (!playingClip || t < playingClip.start || t >= playingClip.end) {
      setPlayingClipId(null)
      setIsClipPaused(false)
    }
  }

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time)

    if (!playingClipId || !project) return

    const playingClip = project.clips.find((clip) => clip.id === playingClipId)
    if (!playingClip) {
      setPlayingClipId(null)
      setIsClipPaused(false)
      return
    }

    if (time >= playingClip.end) {
      videoPlayerRef.current?.pause()
      setPlayingClipId(null)
      setIsClipPaused(false)
    }
  }

  const handlePlayClip = (clip: ClipRange) => {
    const player = videoPlayerRef.current
    if (!player) return

    const isSameClip = playingClipId === clip.id

    if (isSameClip && !player.paused) {
      player.pause()
      setCurrentTime(player.currentTime)
      setIsClipPaused(true)
      return
    }

    if (playingClipId && playingClipId !== clip.id) {
      player.pause()
    }

    const resumeTime = isSameClip && currentTime >= clip.start && currentTime < clip.end
      ? currentTime
      : clip.start

    player.currentTime = resumeTime
    setCurrentTime(resumeTime)
    setPlayingClipId(clip.id)
    setIsClipPaused(false)
    void player.play().catch(() => {
      setPlayingClipId(null)
      setIsClipPaused(false)
    })
  }

  const changeZoom = (direction: -1 | 1) => {
    const currentIndex = zoomLevels.indexOf(zoomLevel)
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0
    const nextIndex = clamp(safeCurrentIndex + direction, 0, zoomLevels.length - 1)
    if (nextIndex === safeCurrentIndex) return

    const nextZoomLevel = zoomLevels[nextIndex]
    const duration = Math.max(project?.duration ?? 0, 0)

    if (duration <= 0) {
      setZoomLevel(nextZoomLevel)
      setZoomStart(0)
      return
    }

    const nextWindow = duration / nextZoomLevel
    const maxStart = Math.max(0, duration - nextWindow)
    const anchorTime = clamp(currentTime, 0, duration)

    setZoomLevel(nextZoomLevel)
    setZoomStart(clamp(anchorTime - nextWindow / 2, 0, maxStart))
  }

  const handleZoomChange = (nextZoomLevel: number, nextZoomStart: number) => {
    const duration = Math.max(project?.duration ?? 0, 0)
    const windowDuration = nextZoomLevel > 0 && duration > 0 ? duration / nextZoomLevel : duration
    const maxStart = Math.max(0, duration - windowDuration)

    setZoomLevel(nextZoomLevel)
    setZoomStart(clamp(nextZoomStart, 0, maxStart))
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
      start: Math.max(0, currentTime - preRollSec),
      end: Math.min(project.duration, currentTime + postRollSec),
      label: 'Clip',
      name: '',
      tags: { ...defaultClipTags, players: [] },
    }
    updateClips([...project.clips, clip].sort((a, b) => a.start - b.start))
  }

  const addAnnotation = (annotation: Annotation) => {
    if (!project) return
    updateAnnotations([...project.annotations, annotation])
  }

  const addTeam = (teamName: string) => {
    if (!project || !teamName.trim()) return
    const name = teamName.trim()
    if ((project.teams ?? []).length >= 2) return
    if ((project.teams ?? []).includes(name)) return
    setProject({ ...project, teams: [...(project.teams ?? []), name], updatedAt: Date.now() })
  }

  const removeTeam = (teamName: string) => {
    if (!project) return
    const teams = Array.isArray(project.teams) ? project.teams : []
    const nextClips = project.clips.map((clip) => {
      const tags = normalizeClipTags(clip.tags)
      if (tags.team !== teamName) {
        return { ...clip, tags }
      }

      const nextTags = { ...tags, team: null }
      const name = clip.name ?? ''
      return {
        ...clip,
        name,
        tags: nextTags,
        label: generateClipLabel(nextTags, name),
      }
    })

    setProject({
      ...project,
      teams: teams.filter((team) => team !== teamName),
      clips: nextClips,
      updatedAt: Date.now(),
    })
  }

  const selectClipTeam = (clip: ClipRange, team: string | null) => {
    const tags = normalizeClipTags(clip.tags)
    updateClipTags(clip.id, {
      ...tags,
      team: tags.team === team ? null : team,
    })
  }

  const updateClipTags = (clipId: string, nextTags: ClipTags) => {
    if (!project) return
    updateClips(project.clips.map((clip) => {
      if (clip.id !== clipId) return clip
      const name = clip.name ?? ''
      return {
        ...clip,
        name,
        tags: nextTags,
        label: generateClipLabel(nextTags, name),
      }
    }))
  }

  const renameClip = (clipId: string, name: string) => {
    if (!project) return
    updateClips(project.clips.map((clip) => {
      if (clip.id !== clipId) return clip
      const tags = normalizeClipTags(clip.tags)
      return {
        ...clip,
        name,
        tags,
        label: generateClipLabel(tags, name),
      }
    }))
  }

  const updateClipRange = (clipId: string, start: number, end: number) => {
    if (!project) return
    const duration = project.duration
    const clampedStart = Math.max(0, Math.min(start, duration))
    const clampedEnd = Math.max(0, Math.min(end, duration))
    if (clampedEnd <= clampedStart) return
    updateClips(
      project.clips
        .map((clip) => clip.id === clipId ? { ...clip, start: clampedStart, end: clampedEnd } : clip)
        .sort((a, b) => a.start - b.start),
    )
  }

  const toggleClipPhase = (clip: ClipRange, phase: 'O' | 'D') => {
    const tags = normalizeClipTags(clip.tags)
    updateClipTags(clip.id, {
      ...tags,
      phase: tags.phase === phase ? null : phase,
    })
  }

  const toggleClipError = (clip: ClipRange) => {
    const tags = normalizeClipTags(clip.tags)
    updateClipTags(clip.id, {
      ...tags,
      error: !tags.error,
    })
  }

  const addPlayersToClip = (clip: ClipRange, value: string) => {
    const nextPlayers = value
      .split(',')
      .map((player) => player.trim().replace(/^#/, ''))
      .filter(Boolean)

    if (nextPlayers.length === 0) return

    const tags = normalizeClipTags(clip.tags)
    updateClipTags(clip.id, {
      ...tags,
      players: [...new Set([...tags.players, ...nextPlayers])],
    })
    setPlayerDraft('')
  }

  const removePlayerFromClip = (clip: ClipRange, player: string) => {
    const tags = normalizeClipTags(clip.tags)
    updateClipTags(clip.id, {
      ...tags,
      players: tags.players.filter((current) => current !== player),
    })
  }

  const deleteClip = (clipId: string) => {
    if (!project) return
    updateClips(project.clips.filter((clip) => clip.id !== clipId))
    if (playingClipId === clipId) {
      videoPlayerRef.current?.pause()
      setPlayingClipId(null)
      setIsClipPaused(false)
    }
    if (expandedClipId === clipId) {
      setExpandedClipId(null)
      setPlayerDraft('')
    }
  }

  const clearClipSelection = () => {
    setExpandedClipId(null)
    setPlayingClipId(null)
    setIsClipPaused(false)
    setPlayerDraft('')
  }

  const toggleClipExpanded = (clipId: string) => {
    setExpandedClipId((current) => {
      const nextId = current === clipId ? null : clipId
      if (nextId) {
        const clip = project?.clips.find(c => c.id === clipId)
        if (clip) seek(clip.start)
      }
      return nextId
    })
    setPlayerDraft('')
  }

  const exportExpandedClip = async () => {
    if (!expandedClip || !videoFile || isExporting || ffmpeg.isLoading) return

    const clipIndex = Math.max(0, project?.clips.findIndex((clip) => clip.id === expandedClip.id) ?? 0) + 1
    const exportFileName = `${clipIndex}_${expandedClip.label}.mp4`

    setIsExporting(true)
    try {
      await ffmpeg.load()
      await ffmpeg.exportClip(videoFile, expandedClip.start, expandedClip.end, exportFileName)
    } finally {
      setIsExporting(false)
    }
  }

  const selectedClipId = expandedClipId ?? playingClipId

  const expandedClip = project?.clips.find((clip) => clip.id === expandedClipId)

  useKeyboardShortcuts({
    onPlayPause: () => {
      if (isKeyboardHelpOpen || !videoUrl) return

      const player = videoPlayerRef.current
      if (!player) return

      if (player.paused) {
        if (playingClipId) {
          setIsClipPaused(false)
        }
        void player.play().catch(() => {
          setPlayingClipId(null)
          setIsClipPaused(false)
        })
        return
      }

      player.pause()
      if (playingClipId) {
        setIsClipPaused(true)
      }
    },
    onSeek: (delta) => {
      if (isKeyboardHelpOpen || !videoUrl) return
      seek(currentTime + delta)
    },
    onAddMarker: () => {
      if (!isKeyboardHelpOpen) addMarker()
    },
    onAddClip: () => {
      if (!isKeyboardHelpOpen) addClip()
    },
    onTagOffense: () => {
      if (!isKeyboardHelpOpen && expandedClip) toggleClipPhase(expandedClip, 'O')
    },
    onTagDefense: () => {
      if (!isKeyboardHelpOpen && expandedClip) toggleClipPhase(expandedClip, 'D')
    },
    onTagError: () => {
      if (!isKeyboardHelpOpen && expandedClip) toggleClipError(expandedClip)
    },
    onShowHelp: () => setIsKeyboardHelpOpen(true),
  })

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
          <button
            className="titlebar-help-btn"
            type="button"
            aria-label="Keyboard shortcuts"
            onClick={() => setIsKeyboardHelpOpen(true)}
          >
            ?
          </button>
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
                  <>
                    <dl className="metadata-list">
                      <div><dt>File</dt><dd title={project.videoFileName}>{project.videoFileName}</dd></div>
                      <div><dt>Duration</dt><dd>{fmt(project.duration)}</dd></div>
                    </dl>
                    <div className="team-section">
                      <div className="team-section__title">Teams</div>
                      <div className="team-list">
                        {(project.teams ?? []).map((team) => (
                          <span className="team-badge" key={team}>
                            {team}
                            <button
                              className="team-badge__remove"
                              type="button"
                              aria-label={`Remove ${team}`}
                              onClick={() => removeTeam(team)}
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                      {(project.teams ?? []).length < 2 && (
                        <TeamAddInput key={(project.teams ?? []).length} onAdd={addTeam} />
                      )}
                    </div>
                  </>
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
                    {project.clips.map((clip) => {
                      const tags = normalizeClipTags(clip.tags)
                      const isExpanded = expandedClipId === clip.id
                      const isActiveClipPlayback = playingClipId === clip.id
                      const isPlayingClip = isActiveClipPlayback && !isClipPaused

                      return (
                        <div className="clip-item" key={clip.id}>
                          <div className={`clip-row${selectedClipId === clip.id ? ' clip-row--selected' : ''}`}>
                            <div
                              className="clip-row__main"
                              onClick={() => toggleClipExpanded(clip.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  toggleClipExpanded(clip.id)
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${clip.label} tags`}
                            >
                              <span className="clip-row__label" title={clip.label}>
                                {clip.label}
                              </span>
                              <span className="clip-row__range">
                                {fmt(clip.start)} &rarr; {fmt(clip.end)}&nbsp;
                                <span className="clip-row__duration">({Math.round(clip.end - clip.start)}s)</span>
                              </span>
                            </div>
                            <button
                              className={`clip-row__play${isActiveClipPlayback ? ' clip-row__play--active' : ''}`}
                              aria-label={`${isPlayingClip ? 'Pause' : 'Play'} ${clip.label}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handlePlayClip(clip)
                              }}
                              type="button"
                            >
                              {isPlayingClip ? 'Ⅱ' : '▶'}
                            </button>
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

                          {isExpanded && (
                            <div className="clip-tags" onClick={(event) => event.stopPropagation()}>
                              {(project.teams ?? []).length > 0 && (
                                <div className="clip-tag-row">
                                  <span className="clip-tags__label">Team</span>
                                  {(project.teams ?? []).map((team) => (
                                    <button
                                      className={`tag-btn${tags.team === team ? ' tag-btn--active-team' : ''}`}
                                      key={team}
                                      onClick={() => selectClipTeam(clip, team)}
                                      type="button"
                                    >
                                      {team}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="clip-tag-row">
                                <button
                                  className={`tag-btn${tags.phase === 'O' ? ' tag-btn--active-phase' : ''}`}
                                  onClick={() => toggleClipPhase(clip, 'O')}
                                  type="button"
                                >
                                  O
                                </button>
                                <button
                                  className={`tag-btn${tags.phase === 'D' ? ' tag-btn--active-phase' : ''}`}
                                  onClick={() => toggleClipPhase(clip, 'D')}
                                  type="button"
                                >
                                  D
                                </button>
                                <button
                                  className={`tag-btn${tags.error ? ' tag-btn--active-error' : ''}`}
                                  onClick={() => toggleClipError(clip)}
                                  type="button"
                                >
                                  E
                                </button>
                              </div>
                              <div className="clip-tag-row">
                                <span className="clip-tags__label">Players</span>
                                {tags.players.map((player) => (
                                  <button
                                    className="player-badge"
                                    key={player}
                                    onClick={() => removePlayerFromClip(clip, player)}
                                    type="button"
                                  >
                                    #{player} <span aria-hidden="true">x</span>
                                  </button>
                                ))}
                                <input
                                  className="player-add-input"
                                  aria-label="Add player number"
                                  value={playerDraft}
                                  onChange={(event) => {
                                    const nextValue = event.target.value
                                    if (nextValue.includes(',')) {
                                      addPlayersToClip(clip, nextValue)
                                      return
                                    }
                                    setPlayerDraft(nextValue)
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      addPlayersToClip(clip, playerDraft)
                                    }
                                  }}
                                  placeholder="+"
                                />
                              </div>
                              <div className="clip-tag-row clip-tag-row--name">
                                <span className="clip-tags__label">Name</span>
                                <input
                                  className="clip-name-input"
                                  aria-label="Clip play name"
                                  value={clip.name ?? ''}
                                  onChange={(event) => renameClip(clip.id, event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      event.currentTarget.blur()
                                      clearClipSelection()
                                    }
                                  }}
                                  placeholder="Play name"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <span className="panel-empty">Add Clip to get started</span>
                )}
              </div>
            </div>
          </aside>

          {/* Viewer */}
          <div className="viewer">
            {videoUrl && project ? (
              <div className="video-stage" ref={videoStageRef}>
                <VideoPlayer
                  src={videoUrl}
                  onDurationChange={setDuration}
                  onTimeUpdate={handleTimeUpdate}
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
              <FileImporter onFile={handleFile} />
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
              <div className="preroll-label">Pre-roll</div>
              <select
                className="preroll-select"
                value={preRollSec}
                onChange={(event) => setPreRollSec(Number(event.target.value))}
              >
                {[8, 9, 10, 11, 12, 13, 14, 15].map((n) => (
                  <option key={n} value={n}>{n} s</option>
                ))}
              </select>
              <div className="preroll-label">Post-roll</div>
              <select
                className="preroll-select"
                value={postRollSec}
                onChange={(event) => setPostRollSec(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n} s</option>
                ))}
              </select>
            </div>
            <div className="panel-section panel-section--export">
              <div className="panel-body">
                <button
                  className="btn-primary btn-block"
                  onClick={exportExpandedClip}
                  disabled={!expandedClip || !videoFile || ffmpeg.isLoading || isExporting}
                  type="button"
                >
                  {ffmpeg.isLoading ? 'Loading ffmpeg...' : isExporting ? 'Exporting...' : 'Export selected clips'}
                </button>
                {(ffmpeg.isLoading || isExporting) && (
                  <div className="export-progress">
                    <span>{ffmpeg.isLoading ? 'Preparing exporter' : `${Math.round(ffmpeg.progress)}%`}</span>
                    <div className="progress-bar" aria-hidden="true">
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${Math.max(0, Math.min(100, ffmpeg.progress))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>

        </div>

        {/* Timeline dock */}
        <div className="timeline-dock">
          <div className="timeline-dock-header">
            <span className="timeline-dock-title">Timeline</span>
            <div className="zoom-controls" aria-label="Timeline zoom controls">
              <button
                className="zoom-btn"
                type="button"
                aria-label="Zoom out"
                disabled={!project || zoomLevel === zoomLevels[0]}
                onClick={() => changeZoom(-1)}
              >
                −
              </button>
              <span className="zoom-label">{zoomLevel}x</span>
              <button
                className="zoom-btn"
                type="button"
                aria-label="Zoom in"
                disabled={!project || zoomLevel === zoomLevels[zoomLevels.length - 1]}
                onClick={() => changeZoom(1)}
              >
                +
              </button>
            </div>
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
              zoomLevel={zoomLevel}
              zoomStart={zoomStart}
              editingClipId={expandedClipId}
              onZoomChange={handleZoomChange}
              onSeek={seek}
              onClipTrim={updateClipRange}
            />
          </div>
        </div>

      </div>

      {isKeyboardHelpOpen && (
        <div
          className="shortcut-modal"
          aria-modal="true"
          role="dialog"
          aria-labelledby="shortcut-modal-title"
          onClick={() => setIsKeyboardHelpOpen(false)}
        >
          <div className="shortcut-modal__card" onClick={(event) => event.stopPropagation()}>
            <div className="shortcut-modal__header">
              <h2 id="shortcut-modal-title">Keyboard Shortcuts</h2>
              <button
                className="shortcut-modal__close"
                type="button"
                aria-label="Close keyboard shortcuts"
                onClick={() => setIsKeyboardHelpOpen(false)}
              >
                x
              </button>
            </div>

            <div className="shortcut-modal__section">
              <h3>Playback</h3>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>Space</kbd></span><span>Play / Pause</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>←</kbd></span><span>Seek back 10 seconds</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>→</kbd></span><span>Seek forward 10 seconds</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>Shift</kbd><kbd>←</kbd></span><span>Seek back 1 second</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>Shift</kbd><kbd>→</kbd></span><span>Seek forward 1 second</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>J</kbd></span><span>Seek back 10 seconds</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>K</kbd></span><span>Play / Pause</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>L</kbd></span><span>Seek forward 10 seconds</span></div>
            </div>

            <div className="shortcut-modal__section">
              <h3>Edit</h3>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>M</kbd></span><span>Add marker at current time</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>S</kbd><kbd>C</kbd></span><span>Add clip around current time</span></div>
            </div>

            <div className="shortcut-modal__section">
              <h3>Tags</h3>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>O</kbd></span><span>Toggle Offense on expanded clip</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>D</kbd></span><span>Toggle Defense on expanded clip</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>E</kbd></span><span>Toggle Error on expanded clip</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>?</kbd></span><span>Show this shortcut list</span></div>
              <div className="shortcut-row"><span className="shortcut-keys"><kbd>Esc</kbd></span><span>Close this shortcut list</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

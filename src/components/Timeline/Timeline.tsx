import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { ClipRange, Marker } from '../../types'

type TimelineProps = {
  duration: number
  currentTime: number
  markers: Marker[]
  clips: ClipRange[]
  zoomLevel: number
  zoomStart: number
  onZoomChange: (zoomLevel: number, zoomStart: number) => void
  onSeek: (time: number) => void
  editingClipId?: string | null
  onClipTrim?: (clipId: string, start: number, end: number) => void
}

const width = 1000
const svgHeight = 92
const rulerHeight = 24
const trackTop = 32
const trackHeight = 40
const tickSteps = [1, 5, 10, 30, 60, 300]
const minClipDurationSec = 0.2

type ClipDragMode = 'move' | 'start' | 'end'

type ClipDragState = {
  clipId: string
  mode: ClipDragMode
  pointerStartTime: number
  clipStart: number
  clipEnd: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const formatTime = (time: number) => {
  const safeTime = Math.max(0, time)
  const minutes = Math.floor(safeTime / 60)
  const seconds = Math.floor(safeTime % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function Timeline({
  duration,
  currentTime,
  markers,
  clips,
  zoomLevel,
  zoomStart,
  onZoomChange,
  onSeek,
  editingClipId,
  onClipTrim,
}: TimelineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [clipDrag, setClipDrag] = useState<ClipDragState | null>(null)
  const safeDuration = Math.max(duration, 0)
  const safeZoomLevel = Math.max(zoomLevel, 1)
  const visibleDuration = safeDuration > 0 ? safeDuration / safeZoomLevel : 0
  const maxZoomStart = Math.max(0, safeDuration - visibleDuration)
  const visibleStart = clamp(zoomStart, 0, maxZoomStart)
  const visibleEnd = Math.min(safeDuration, visibleStart + visibleDuration)

  const timeToX = (time: number) => {
    if (visibleDuration <= 0) return 0
    return clamp(((time - visibleStart) / visibleDuration) * width, 0, width)
  }

  const ratio = visibleDuration > 0 ? clamp((currentTime - visibleStart) / visibleDuration, 0, 1) : 0
  const playheadX = ratio * width
  const tickStep = tickSteps.find((step) => visibleDuration / step <= 12) ?? tickSteps[tickSteps.length - 1]
  const firstTick = Math.ceil(visibleStart / tickStep) * tickStep
  const ticks: number[] = []

  for (let tickTime = firstTick; tickTime <= visibleEnd; tickTime += tickStep) {
    ticks.push(tickTime)
  }

  useEffect(() => {
    if (safeDuration <= 0 || safeZoomLevel <= 1) return
    if (currentTime >= visibleStart && currentTime <= visibleEnd) return

    const nextStart = currentTime < visibleStart
      ? currentTime
      : currentTime - visibleDuration

    onZoomChange(safeZoomLevel, clamp(nextStart, 0, maxZoomStart))
  }, [
    currentTime,
    maxZoomStart,
    onZoomChange,
    safeDuration,
    safeZoomLevel,
    visibleDuration,
    visibleEnd,
    visibleStart,
  ])

  const timeFromClientX = (clientX: number) => {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds || visibleDuration === 0) {
      return null
    }

    const nextRatio = clamp((clientX - bounds.left) / bounds.width, 0, 1)
    return visibleStart + nextRatio * visibleDuration
  }

  const seekFromClientX = (clientX: number) => {
    const nextTime = timeFromClientX(clientX)
    if (nextTime === null) return
    onSeek(nextTime)
  }

  const trimClip = (drag: ClipDragState, clientX: number) => {
    const pointerTime = timeFromClientX(clientX)
    if (pointerTime === null || !onClipTrim) return

    if (drag.mode === 'start') {
      const nextStart = clamp(pointerTime, 0, drag.clipEnd - minClipDurationSec)
      onClipTrim(drag.clipId, nextStart, drag.clipEnd)
      onSeek(nextStart)
      return
    }

    if (drag.mode === 'end') {
      const nextEnd = clamp(pointerTime, drag.clipStart + minClipDurationSec, safeDuration)
      onClipTrim(drag.clipId, drag.clipStart, nextEnd)
      onSeek(nextEnd)
      return
    }

    const clipDuration = drag.clipEnd - drag.clipStart
    const delta = pointerTime - drag.pointerStartTime
    const nextStart = clamp(drag.clipStart + delta, 0, Math.max(0, safeDuration - clipDuration))
    const nextEnd = nextStart + clipDuration
    onClipTrim(drag.clipId, nextStart, nextEnd)
    onSeek(nextStart)
  }

  const startClipDrag = (
    event: ReactMouseEvent<SVGGElement | SVGRectElement>,
    clip: ClipRange,
    mode: ClipDragMode,
  ) => {
    if (!onClipTrim) return
    event.preventDefault()
    event.stopPropagation()

    const pointerStartTime = timeFromClientX(event.clientX)
    if (pointerStartTime === null) return

    const dragState: ClipDragState = {
      clipId: clip.id,
      mode,
      pointerStartTime,
      clipStart: clip.start,
      clipEnd: clip.end,
    }

    setIsDragging(true)
    setClipDrag(dragState)

    const handleMove = (moveEvent: MouseEvent) => {
      trimClip(dragState, moveEvent.clientX)
    }

    const handleUp = () => {
      setIsDragging(false)
      setClipDrag(null)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <section className="timeline-panel">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${svgHeight}`}
        className={`timeline-svg ${isDragging ? 'timeline-svg--dragging' : ''}${clipDrag ? ` timeline-svg--${clipDrag.mode}` : ''}`}
        role="img"
        onClick={(event) => seekFromClientX(event.clientX)}
        onMouseDown={(event) => {
          setIsDragging(true)
          seekFromClientX(event.clientX)

          const handleMove = (moveEvent: MouseEvent) => {
            seekFromClientX(moveEvent.clientX)
          }
          const handleUp = () => {
            setIsDragging(false)
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleUp)
          }

          window.addEventListener('mousemove', handleMove)
          window.addEventListener('mouseup', handleUp)
        }}
      >
        <title>Project timeline</title>
        <rect x="0" y="0" width={width} height={rulerHeight} className="timeline-ruler-bg" />
        {ticks.map((tickTime) => {
          const tickX = timeToX(tickTime)

          return (
            <g key={tickTime}>
              <line
                x1={tickX}
                y1={rulerHeight - 7}
                x2={tickX}
                y2={rulerHeight}
                className="timeline-tick"
              />
              <text x={tickX + 4} y="14" className="timeline-tick-label">
                {formatTime(tickTime)}
              </text>
            </g>
          )
        })}
        <rect
          x="0"
          y={trackTop}
          width={width}
          height={trackHeight}
          rx="4"
          className="timeline-track-bg"
        />
        {clips.map((clip) => {
          if (clip.end < visibleStart || clip.start > visibleEnd) return null

          const clipStart = timeToX(clip.start)
          const clipEnd = timeToX(clip.end)
          const clipWidth = clipEnd - clipStart
          const visibleClipX = clamp(clipStart, 0, width)
          const visibleClipEnd = clamp(clipEnd, 0, width)
          const visibleClipWidth = Math.max(visibleClipEnd - visibleClipX, 3)
          const isEditing = editingClipId === clip.id

          return (
            <g
              key={clip.id}
              className={`timeline-clip-group${isEditing ? ' timeline-clip-group--editing' : ''}`}
              onMouseDown={(event) => startClipDrag(event, clip, 'move')}
              onClick={(event) => event.stopPropagation()}
            >
              <rect
                x={visibleClipX}
                y={trackTop + 3}
                width={visibleClipWidth}
                height={trackHeight - 6}
                rx="5"
                className="timeline-clip"
              />
              <rect
                x={clamp(clipStart - 5, 0, width - 10)}
                y={trackTop - 1}
                width="10"
                height={trackHeight + 2}
                rx="3"
                className="timeline-clip-handle timeline-clip-handle--start"
                onMouseDown={(event) => startClipDrag(event, clip, 'start')}
              />
              <rect
                x={clamp(clipEnd - 5, 0, width - 10)}
                y={trackTop - 1}
                width="10"
                height={trackHeight + 2}
                rx="3"
                className="timeline-clip-handle timeline-clip-handle--end"
                onMouseDown={(event) => startClipDrag(event, clip, 'end')}
              />
              {clipWidth > 30 && (
                <text
                  x={clamp(clipStart + 6, 6, width - 80)}
                  y={trackTop + 25}
                  className="timeline-clip-label"
                >
                  {clip.label}
                </text>
              )}
            </g>
          )
        })}
        {markers.map((marker) => {
          if (marker.time < visibleStart || marker.time > visibleEnd) return null

          const markerX = timeToX(marker.time)

          return (
            <g key={marker.id}>
              <line
                x1={markerX}
                y1={rulerHeight}
                x2={markerX}
                y2={svgHeight}
                className="timeline-marker"
                style={{ stroke: marker.color }}
              />
              <text
                x={clamp(markerX + 6, 6, width - 100)}
                y={rulerHeight - 4}
                className="timeline-marker-label"
                style={{ fill: marker.color }}
              >
                {marker.label}
              </text>
            </g>
          )
        })}
        <line
          x1={playheadX}
          y1={trackTop - 9}
          x2={playheadX}
          y2={trackTop + trackHeight + 9}
          className="timeline-playhead"
        />
        <polygon
          points={`${playheadX - 5},${trackTop - 12} ${playheadX + 5},${trackTop - 12} ${playheadX},${trackTop - 5}`}
          className="timeline-playhead-handle"
        />
      </svg>
      <div className="timeline-meta">
        <span>{formatTime(visibleStart)}</span>
        <span className="timeline-meta-current">{formatTime(currentTime)}</span>
        <span>{formatTime(visibleEnd)}</span>
      </div>
    </section>
  )
}

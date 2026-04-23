import { useRef, useState } from 'react'
import type { ClipRange, Marker } from '../../types'

type TimelineProps = {
  duration: number
  currentTime: number
  markers: Marker[]
  clips: ClipRange[]
  onSeek: (time: number) => void
}

const width = 1000
const height = 132

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
  onSeek,
}: TimelineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const safeDuration = Math.max(duration, 0)
  const ratio = safeDuration > 0 ? clamp(currentTime / safeDuration, 0, 1) : 0
  const playheadX = ratio * width

  const seekFromClientX = (clientX: number) => {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds || safeDuration === 0) {
      return
    }

    const nextRatio = clamp((clientX - bounds.left) / bounds.width, 0, 1)
    onSeek(nextRatio * safeDuration)
  }

  return (
    <section className="timeline-panel">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`timeline-svg ${isDragging ? 'timeline-svg--dragging' : ''}`}
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
        <rect x="0" y="0" width={width} height={height} className="timeline-bg" />
        <line x1="0" y1="72" x2={width} y2="72" className="timeline-track" />
        {clips.map((clip) => {
          const clipStart = safeDuration > 0 ? (clip.start / safeDuration) * width : 0
          const clipWidth =
            safeDuration > 0 ? ((clip.end - clip.start) / safeDuration) * width : 0

          return (
            <g key={clip.id}>
              <rect
                x={clamp(clipStart, 0, width)}
                y="50"
                width={Math.max(clipWidth, 3)}
                height="44"
                className="timeline-clip"
              />
              <text x={clamp(clipStart + 6, 6, width - 80)} y="45" className="timeline-label">
                {clip.label}
              </text>
            </g>
          )
        })}
        {markers.map((marker) => {
          const markerX = safeDuration > 0 ? (marker.time / safeDuration) * width : 0

          return (
            <g key={marker.id}>
              <line
                x1={markerX}
                y1="24"
                x2={markerX}
                y2="112"
                className="timeline-marker"
                style={{ stroke: marker.color }}
              />
              <text
                x={clamp(markerX + 6, 6, width - 100)}
                y="22"
                className="timeline-label"
              >
                {marker.label}
              </text>
            </g>
          )
        })}
        <line
          x1={playheadX}
          y1="10"
          x2={playheadX}
          y2="122"
          className="timeline-playhead"
        />
        <circle cx={playheadX} cy="10" r="8" className="timeline-playhead-handle" />
      </svg>
      <div className="timeline-meta">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </section>
  )
}

import type { RefObject } from 'react'

type VideoPlayerProps = {
  src: string | null
  onDurationChange: (duration: number) => void
  onTimeUpdate: (time: number) => void
  playerRef: RefObject<HTMLVideoElement | null>
}

export function VideoPlayer({
  src,
  onDurationChange,
  onTimeUpdate,
  playerRef,
}: VideoPlayerProps) {
  if (!src) {
    return <div className="video-placeholder">Select a video to begin.</div>
  }

  return (
    <video
      key={src}
      ref={playerRef}
      className="video-player"
      src={src}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        onDurationChange(event.currentTarget.duration || 0)
      }}
      onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
    />
  )
}

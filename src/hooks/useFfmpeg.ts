import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { useCallback, useRef, useState } from 'react'

type FfmpegProgressEvent = {
  progress: number
}

const toFileName = (name: string) =>
  name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'clip.mp4'

export function useFfmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const loadPromiseRef = useRef<Promise<void> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [progress, setProgress] = useState(0)

  const load = useCallback(async () => {
    if (isReady) return
    if (loadPromiseRef.current) return loadPromiseRef.current

    const ffmpeg = ffmpegRef.current ?? new FFmpeg()
    ffmpegRef.current = ffmpeg

    setIsLoading(true)
    loadPromiseRef.current = ffmpeg.load()
      .then(() => {
        setIsReady(true)
      })
      .finally(() => {
        setIsLoading(false)
        loadPromiseRef.current = null
      })

    return loadPromiseRef.current
  }, [isReady])

  const exportClip = useCallback(async (file: File, start: number, end: number, filename: string) => {
    await load()

    const ffmpeg = ffmpegRef.current
    if (!ffmpeg) throw new Error('FFmpeg failed to initialize')

    const inputName = `input-${crypto.randomUUID()}.${file.name.split('.').pop() || 'mp4'}`
    const outputName = toFileName(filename)

    const handleProgress = ({ progress: nextProgress }: FfmpegProgressEvent) => {
      setProgress(Math.round(Math.max(0, Math.min(1, nextProgress)) * 100))
    }

    ffmpeg.on('progress', handleProgress)
    setProgress(0)

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file))
      await ffmpeg.exec([
        '-ss',
        String(start),
        '-to',
        String(end),
        '-i',
        inputName,
        '-c',
        'copy',
        outputName,
      ])

      const data = await ffmpeg.readFile(outputName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: unknown = typeof data === 'string' ? new TextEncoder().encode(data) : data
      const url = URL.createObjectURL(new Blob([raw as BlobPart], { type: 'video/mp4' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = outputName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setProgress(100)
    } finally {
      ffmpeg.off('progress', handleProgress)
      await Promise.allSettled([
        ffmpeg.deleteFile(inputName),
        ffmpeg.deleteFile(outputName),
      ])
    }
  }, [load])

  return {
    load,
    exportClip,
    isLoading,
    isReady,
    progress,
  }
}

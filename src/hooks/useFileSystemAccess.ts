import { useCallback } from 'react'

const VIDEO_ACCEPT =
  'video/mp4,video/quicktime,video/x-m4v,video/x-matroska,video/webm,video/x-msvideo,.mp4,.mov,.m4v,.mkv,.webm,.avi'

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/x-matroska',
  'video/webm',
  'video/x-msvideo',
])

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi'])

const isVideoFile = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return VIDEO_MIME_TYPES.has(file.type) || VIDEO_EXTENSIONS.has(extension)
}

type PickedVideoFile = {
  file: File
  url: string
}

const openFallbackInput = () =>
  new Promise<PickedVideoFile | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = VIDEO_ACCEPT
    input.hidden = true

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null
      resolve(file && isVideoFile(file) ? { file, url: URL.createObjectURL(file) } : null)
      input.remove()
    })

    input.addEventListener('cancel', () => {
      resolve(null)
      input.remove()
    })

    document.body.append(input)
    input.click()
  })

export const useFileSystemAccess = () => {
  const openFile = useCallback(async () => {
    return openFallbackInput()
  }, [])

  return { openFile }
}

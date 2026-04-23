import { useCallback, useRef } from 'react'

type VideoFilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: {
      description?: string
      accept: Record<string, string[]>
    }[]
  }) => Promise<FileSystemFileHandle[]>
}

const openFallbackInput = () =>
  new Promise<File | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*'
    input.hidden = true

    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null)
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
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null)

  const openFile = useCallback(async () => {
    const picker = (window as VideoFilePickerWindow).showOpenFilePicker

    if (!picker) {
      fileHandleRef.current = null
      return openFallbackInput()
    }

    const handles = await picker({
      multiple: false,
      types: [
        {
          description: 'Video files',
          accept: {
            'video/*': ['.mp4', '.mov', '.m4v', '.webm', '.avi'],
          },
        },
      ],
    })
    const handle = handles[0] ?? null
    fileHandleRef.current = handle

    return handle ? handle.getFile() : null
  }, [])

  return { openFile }
}

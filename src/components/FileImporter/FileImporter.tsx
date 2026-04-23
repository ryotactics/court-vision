import { useRef, useState } from 'react'

type FileImporterProps = {
  onFile: (file: File, url: string) => void
}

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

const getVideoFile = (files: FileList | null) =>
  files ? Array.from(files).find(isVideoFile) : null

export function FileImporter({ onFile }: FileImporterProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = (file: File | null | undefined) => {
    if (!file || !isVideoFile(file)) return
    onFile(file, URL.createObjectURL(file))
  }

  const openFile = () => {
    inputRef.current?.click()
  }

  return (
    <section
      className={`file-importer${isDragging ? ' file-importer--dragging' : ''}`}
      onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragOver={(e)  => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(getVideoFile(e.dataTransfer.files)) }}
    >
      <input
        ref={inputRef}
        className="file-importer__input"
        type="file"
        hidden
        accept={VIDEO_ACCEPT}
        onChange={(e) => {
          handleFile(getVideoFile(e.currentTarget.files))
          e.currentTarget.value = ''
        }}
      />

      {/* Icon */}
      <svg className="file-importer-icon" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="1" opacity=".2" />
        <circle cx="26" cy="26" r="18" stroke="currentColor" strokeWidth="1" opacity=".4" />
        <polygon points="21,18 21,34 36,26" fill="currentColor" />
      </svg>

      <div>
        <h1>Court Vision</h1>
        <p>Drop a video file here, or open one from your device.<br />Handles files up to 3 GB with no memory copy.</p>
      </div>

      <button type="button" className="btn-primary" onClick={openFile}>
        Open Video
      </button>
    </section>
  )
}

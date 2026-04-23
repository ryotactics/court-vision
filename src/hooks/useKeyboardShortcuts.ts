import { useEffect } from 'react'

type KeyboardShortcutHandlers = {
  onPlayPause: () => void
  onSeek: (delta: number) => void
  onAddMarker: () => void
  onAddClip: () => void
  onTagOffense?: () => void
  onTagDefense?: () => void
  onTagError?: () => void
  onShowHelp?: () => void
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    target.isContentEditable ||
    target.closest('[contenteditable]') !== null
  )
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()

      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault()
        handlers.onShowHelp?.()
        return
      }

      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()
        handlers.onPlayPause()
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handlers.onSeek(event.shiftKey ? -1 : -10)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handlers.onSeek(event.shiftKey ? 1 : 10)
        return
      }

      if (key === 'j') {
        event.preventDefault()
        handlers.onSeek(-10)
        return
      }

      if (key === 'k') {
        event.preventDefault()
        handlers.onPlayPause()
        return
      }

      if (key === 'l') {
        event.preventDefault()
        handlers.onSeek(10)
        return
      }

      if (key === 'm') {
        event.preventDefault()
        handlers.onAddMarker()
        return
      }

      if (key === 'c' || key === 's') {
        event.preventDefault()
        handlers.onAddClip()
        return
      }

      if (key === 'o') {
        event.preventDefault()
        handlers.onTagOffense?.()
        return
      }

      if (key === 'd') {
        event.preventDefault()
        handlers.onTagDefense?.()
        return
      }

      if (key === 'e') {
        event.preventDefault()
        handlers.onTagError?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}

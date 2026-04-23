import type { SaveStatus } from '../../types'

const labels: Record<SaveStatus, string> = {
  idle: 'Idle',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Error',
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span className={`save-indicator save-indicator--${status}`}>
      <span className="save-indicator__dot" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}

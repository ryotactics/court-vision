import type { ClipTags } from '../types'

const formatPlayer = (player: string) => {
  const trimmed = player.trim()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

export function generateClipLabel(tags: ClipTags): string {
  const parts: string[] = []

  if (tags.phase) {
    parts.push(tags.phase)
  }

  if (tags.error) {
    parts.push('E')
  }

  const players = tags.players.map(formatPlayer).filter((player) => player !== '#')
  if (players.length > 0) {
    parts.push(players.join('&'))
  }

  return parts.length > 0 ? parts.join('_') : 'Clip'
}

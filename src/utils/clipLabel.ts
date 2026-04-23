import type { ClipTags } from '../types'

const formatPlayer = (player: string) => {
  const trimmed = player.trim()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

export function generateClipLabel(tags: ClipTags, name: string): string {
  const parts: string[] = []

  if (tags.team) {
    parts.push(tags.team)
  }

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

  const prefix = parts.length > 0 ? parts.join('_') : 'Clip'
  const trimmedName = name.trim()

  return trimmedName ? `${prefix}_${trimmedName}` : prefix
}

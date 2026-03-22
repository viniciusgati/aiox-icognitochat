const PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
]

/** Returns a deterministic accent color for a given username. */
export function getUserColor(username: string): string {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0 // to 32-bit int
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/** Returns up to 2 uppercase initials from a username. */
export function getUserInitials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}

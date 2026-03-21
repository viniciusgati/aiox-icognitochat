import { randomBytes } from 'crypto'

const ADJECTIVES = [
  'swift', 'dark', 'bold', 'calm', 'cool', 'deep', 'fast', 'free',
  'keen', 'lone', 'mute', 'neat', 'odd', 'pure', 'rare', 'safe',
  'slim', 'true', 'vast', 'wild', 'wise', 'zeal', 'azure', 'brave',
  'crisp', 'dusk', 'echo', 'flux', 'grey', 'haze', 'iron', 'jade',
]

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomChars(length: number): string {
  const bytes = randomBytes(length)
  return Array.from(bytes, (byte) => CHARS[byte % CHARS.length]).join('')
}

function randomAdjective(): string {
  const idx = randomBytes(1)[0] % ADJECTIVES.length
  return ADJECTIVES[idx]
}

export function generateUsername(): string {
  const adjective = randomAdjective()
  const suffix = randomChars(4).toLowerCase()
  return `${adjective}-${suffix}`
}

export function generatePassword(): string {
  return randomChars(10)
}

export function generateCredentials(): { username: string; password: string } {
  return {
    username: generateUsername(),
    password: generatePassword(),
  }
}

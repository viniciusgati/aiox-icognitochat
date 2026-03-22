export type LocalTtlOption = 'off' | '30s' | '1m' | '5m' | '10m' | '30m' | '1h'

export interface PrivacyPrefs {
  localTtl: LocalTtlOption
}

const STORAGE_KEY = 'icognitochat:privacy-prefs'
const DEFAULTS: PrivacyPrefs = { localTtl: 'off' }

export const TTL_OPTIONS: { value: LocalTtlOption; label: string; seconds: number | null }[] = [
  { value: 'off', label: 'Desativado', seconds: null },
  { value: '30s', label: '30 segundos', seconds: 30 },
  { value: '1m', label: '1 minuto', seconds: 60 },
  { value: '5m', label: '5 minutos', seconds: 300 },
  { value: '10m', label: '10 minutos', seconds: 600 },
  { value: '30m', label: '30 minutos', seconds: 1800 },
  { value: '1h', label: '1 hora', seconds: 3600 },
]

export function getPrivacyPrefs(): PrivacyPrefs {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function savePrivacyPrefs(prefs: PrivacyPrefs): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

/** Returns the effective TTL in seconds — the most restrictive between local pref and room TTL. */
export function getEffectiveTtlSeconds(
  localTtl: LocalTtlOption,
  roomTtlSeconds?: number
): number | null {
  const localSeconds = TTL_OPTIONS.find((o) => o.value === localTtl)?.seconds ?? null

  if (localSeconds === null && !roomTtlSeconds) return null
  if (localSeconds === null) return roomTtlSeconds ?? null
  if (!roomTtlSeconds) return localSeconds
  return Math.min(localSeconds, roomTtlSeconds)
}

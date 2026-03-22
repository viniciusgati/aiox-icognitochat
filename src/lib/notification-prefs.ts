export type SoundOption = 'none' | 'bubble' | 'ping' | 'chime' | 'pop'

export interface NotificationPrefs {
  enabled: boolean
  sound: SoundOption
}

const STORAGE_KEY = 'icognitochat:notification-prefs'
const DEFAULTS: NotificationPrefs = { enabled: true, sound: 'bubble' }

export function getPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function savePrefs(prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

// ─── Web Audio synthesis (no MP3 files required) ─────────────────────────────

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
) {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.type = type
  osc.frequency.value = freq
  gainNode.gain.setValueAtTime(gain, ctx.currentTime + delay)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + duration + 0.05)
}

export function playSound(sound: SoundOption): void {
  if (sound === 'none') return
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()

    switch (sound) {
      case 'bubble':
        // Short soft blip
        playTone(ctx, 660, 0.12, 'sine', 0.25)
        break
      case 'ping':
        // Clear high-pitched ding
        playTone(ctx, 1046, 0.35, 'sine', 0.35)
        break
      case 'chime':
        // Two-note bell chord
        playTone(ctx, 523, 0.5, 'sine', 0.3)
        playTone(ctx, 784, 0.5, 'sine', 0.2, 0.08)
        break
      case 'pop':
        // Quick low tap
        playTone(ctx, 180, 0.07, 'square', 0.2)
        break
    }

    // Safari requires a resume after creation
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    // AudioContext not available — silently ignore
  }
}

'use client'

import { useState } from 'react'
import { getPrefs, savePrefs, playSound, type SoundOption, type NotificationPrefs } from '@/lib/notification-prefs'

interface Props {
  onClose: () => void
}

const SOUND_OPTIONS: { value: SoundOption; label: string }[] = [
  { value: 'none', label: 'Silencioso' },
  { value: 'bubble', label: 'Bolha' },
  { value: 'ping', label: 'Ping' },
  { value: 'chime', label: 'Sino' },
  { value: 'pop', label: 'Pop' },
]

export default function NotificationSettings({ onClose }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => getPrefs())

  function updatePrefs(patch: Partial<NotificationPrefs>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    savePrefs(next)
  }

  function handleSoundSelect(sound: SoundOption) {
    updatePrefs({ sound })
    playSound(sound)
  }

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl bg-slate-800 border border-slate-700 shadow-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Notificações sonoras</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-lg leading-none"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>

      {/* Enable toggle */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-slate-300">Ativar sons</span>
        <button
          role="switch"
          aria-checked={prefs.enabled}
          onClick={() => updatePrefs({ enabled: !prefs.enabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
            prefs.enabled ? 'bg-indigo-600' : 'bg-slate-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
              prefs.enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </label>

      {/* Sound selector */}
      {prefs.enabled && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Som</p>
          {SOUND_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleSoundSelect(value)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                prefs.sound === value
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-600/50'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{label}</span>
              {value !== 'none' && (
                <span className="text-xs text-slate-500">▶ preview</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

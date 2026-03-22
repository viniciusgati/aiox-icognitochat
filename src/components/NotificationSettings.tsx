'use client'

import { useState } from 'react'
import { getPrefs, savePrefs, playSound, type SoundOption, type NotificationPrefs } from '@/lib/notification-prefs'
import type { PushStatus } from '@/lib/use-push-subscription'

interface Props {
  onClose: () => void
  pushStatus: PushStatus
  onRequestPush: () => Promise<PushStatus>
}

const SOUND_OPTIONS: { value: SoundOption; label: string }[] = [
  { value: 'none', label: 'Silencioso' },
  { value: 'bubble', label: 'Bolha' },
  { value: 'ping', label: 'Ping' },
  { value: 'chime', label: 'Sino' },
  { value: 'pop', label: 'Pop' },
]

function PushSection({ pushStatus, onRequestPush }: { pushStatus: PushStatus; onRequestPush: () => Promise<PushStatus> }) {
  const [requesting, setRequesting] = useState(false)

  async function handleEnable() {
    setRequesting(true)
    await onRequestPush()
    setRequesting(false)
  }

  if (pushStatus === 'unsupported') {
    return (
      <div className="rounded-lg bg-zinc-800 px-3 py-2.5">
        <p className="text-xs text-zinc-500">Push não suportado neste dispositivo/browser.</p>
      </div>
    )
  }

  if (pushStatus === 'granted') {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-300">Push ativo</span>
        <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">✓ ativo</span>
      </div>
    )
  }

  if (pushStatus === 'denied') {
    return (
      <div className="rounded-lg bg-zinc-800 px-3 py-2.5 space-y-1">
        <p className="text-xs text-amber-400">Push bloqueado no navegador.</p>
        <p className="text-xs text-zinc-500">Para ativar: clique no cadeado na barra de endereços e permita notificações.</p>
      </div>
    )
  }

  // 'default' or 'loading'
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-zinc-300">Push (mesmo com app fechado)</p>
        <p className="text-xs text-zinc-600 mt-0.5">Receba avisos do admin</p>
      </div>
      <button
        onClick={handleEnable}
        disabled={requesting || pushStatus === 'loading'}
        className="text-xs rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-50 px-3 py-1.5 text-white font-medium transition-colors shrink-0 ml-3"
      >
        {requesting ? '…' : 'Ativar'}
      </button>
    </div>
  )
}

export default function NotificationSettings({ onClose, pushStatus, onRequestPush }: Props) {
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
    <div className="absolute right-0 top-full mt-2 z-[100] w-72 rounded-xl bg-zinc-900 border border-white/[0.08] shadow-modal p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Notificações</h3>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 text-lg leading-none transition-colors"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>

      {/* Push notifications */}
      <div className="space-y-2">
        <p className="text-xs text-zinc-600 uppercase tracking-wide">Push</p>
        <PushSection pushStatus={pushStatus} onRequestPush={onRequestPush} />
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* Sound notifications */}
      <div className="space-y-2">
        <p className="text-xs text-zinc-600 uppercase tracking-wide">Sons no navegador</p>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-zinc-300">Ativar sons</span>
          <button
            role="switch"
            aria-checked={prefs.enabled}
            onClick={() => updatePrefs({ enabled: !prefs.enabled })}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
              prefs.enabled ? 'bg-brand-500' : 'bg-zinc-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                prefs.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        {prefs.enabled && (
          <div className="space-y-1">
            {SOUND_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleSoundSelect(value)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  prefs.sound === value
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span>{label}</span>
                {value !== 'none' && (
                  <span className="text-xs text-zinc-600">▶ preview</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

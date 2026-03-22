'use client'

import { useState } from 'react'
import { TTL_OPTIONS, LocalTtlOption, getPrivacyPrefs, savePrivacyPrefs } from '@/lib/privacy-prefs'
import { wipeDevice } from '@/lib/device-wipe'

const WIPE_ITEMS = [
  'Sessão ativa (logout)',
  'Preferências salvas (localStorage)',
  'Cache do app (Service Worker)',
  'Histórico de mensagens em memória',
]

const CONFIRM_WORD = 'APAGAR'

interface Props {
  onClose: () => void
  onTtlChange: (ttl: LocalTtlOption) => void
  onBeforeWipe?: () => void
}

export default function PrivacyPanel({ onClose, onTtlChange, onBeforeWipe }: Props) {
  const [localTtl, setLocalTtl] = useState<LocalTtlOption>(() => getPrivacyPrefs().localTtl)
  const [showWipeConfirm, setShowWipeConfirm] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [wiping, setWiping] = useState(false)

  function handleTtlChange(value: LocalTtlOption) {
    setLocalTtl(value)
    savePrivacyPrefs({ localTtl: value })
    onTtlChange(value)
  }

  async function handleWipe() {
    setWiping(true)
    await wipeDevice(onBeforeWipe)
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-surface-900 border border-white/[0.08] rounded-2xl shadow-2xl z-[200] p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-100">Privacidade</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 transition-colors text-base leading-none"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>

      {/* Local TTL */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
          Autodestruição local
        </p>
        <p className="text-[11px] text-zinc-600">
          Mensagens desaparecem do seu dispositivo após o prazo escolhido.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {TTL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTtlChange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 border
                ${localTtl === opt.value
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'bg-surface-800 border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-surface-700'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06]" />

      {/* Wipe device */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
          Apagar dispositivo
        </p>

        {!showWipeConfirm ? (
          <>
            <p className="text-[11px] text-zinc-600">
              Encerra a sessão e apaga todos os dados locais.
            </p>
            <button
              onClick={() => setShowWipeConfirm(true)}
              className="rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-4 py-2 text-xs font-semibold text-red-400 transition-all duration-150"
            >
              🗑 Limpar tudo e sair
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-red-400 font-semibold">
              Isso irá apagar permanentemente:
            </p>
            <ul className="text-[11px] text-zinc-500 space-y-0.5 pl-3">
              {WIPE_ITEMS.map((item) => (
                <li key={item} className="list-disc">{item}</li>
              ))}
            </ul>
            <p className="text-[11px] text-zinc-400 mt-1">
              Digite <span className="font-bold text-red-400">{CONFIRM_WORD}</span> para confirmar:
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={CONFIRM_WORD}
              disabled={wiping}
              className="rounded-lg bg-surface-800 border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-red-500/50 disabled:opacity-40"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="flex gap-2">
              <button
                onClick={handleWipe}
                disabled={wiping || confirmInput !== CONFIRM_WORD}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-red-900/40 px-3 py-2 text-xs font-bold text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {wiping ? 'Apagando…' : 'Apagar tudo'}
              </button>
              <button
                onClick={() => { setShowWipeConfirm(false); setConfirmInput('') }}
                disabled={wiping}
                className="flex-1 rounded-xl bg-surface-700 hover:bg-surface-600 border border-white/[0.06] px-3 py-2 text-xs font-medium text-zinc-400 transition-all duration-150 disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

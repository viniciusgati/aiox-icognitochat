'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'

interface Room {
  id: number
  slug: string
  name: string
  created_at?: number
  is_ephemeral?: number
  message_ttl_seconds?: number | null
}

interface Props {
  onClose: () => void
  onCreated: (room: Room, maxParticipants?: number) => void
}

const TTL_OPTIONS = [
  { label: 'Desativado', value: '' },
  { label: '30 segundos', value: '30' },
  { label: '1 minuto', value: '60' },
  { label: '5 minutos', value: '300' },
  { label: '10 minutos', value: '600' },
  { label: '30 minutos', value: '1800' },
  { label: '1 hora', value: '3600' },
]

export default function CreateRoomModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [ephemeral, setEphemeral] = useState(false)
  const [maxParticipants, setMaxParticipants] = useState('')
  const [messageTtl, setMessageTtl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const body: Record<string, unknown> = ephemeral ? { ephemeral: true } : { name }
      if (messageTtl) body.messageTtlSeconds = parseInt(messageTtl, 10)

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao criar sala')
        return
      }

      const max = maxParticipants ? parseInt(maxParticipants, 10) : undefined
      onCreated(data.room, max && !isNaN(max) && max >= 2 ? max : undefined)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-900 border border-white/[0.08] p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Nova Sala</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 transition-colors text-lg leading-none p-1 rounded-lg hover:bg-surface-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ephemeral toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl bg-surface-800 border border-white/[0.05] hover:border-white/[0.09] transition-colors">
            <div className="relative shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={ephemeral}
                onChange={(e) => setEphemeral(e.target.checked)}
              />
              <div
                className={`w-10 h-6 rounded-full transition-colors duration-150 ${
                  ephemeral ? 'bg-brand-500' : 'bg-surface-600'
                }`}
              />
              <div
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150 ${
                  ephemeral ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Sala Rápida</p>
              <p className="text-xs text-zinc-600 mt-0.5">Apagada quando todos saírem</p>
            </div>
          </label>

          {/* Name field */}
          {!ephemeral && (
            <div>
              <label htmlFor="room-name" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
                Nome da Sala
              </label>
              <input
                id="room-name"
                ref={inputRef}
                type="text"
                required
                minLength={2}
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-surface-800 border border-white/[0.07] px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-150 text-sm"
                placeholder="Ex: Jogos, Música…"
              />
            </div>
          )}

          {ephemeral && (
            <>
              <div className="rounded-xl bg-brand-500/8 border border-brand-500/20 px-3 py-2.5">
                <p className="text-xs text-brand-400">
                  🔗 Um link será gerado para você compartilhar. A sala desaparece quando todos saírem.
                </p>
              </div>
              <div>
                <label htmlFor="max-participants" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
                  Máx. participantes <span className="normal-case text-zinc-600">(opcional, mín. 2)</span>
                </label>
                <input
                  id="max-participants"
                  type="number"
                  min={2}
                  max={20}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  className="w-full rounded-xl bg-surface-800 border border-white/[0.07] px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-150 text-sm"
                  placeholder="Sem limite"
                />
              </div>
            </>
          )}

          {/* TTL selector */}
          <div>
            <label htmlFor="message-ttl" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
              Auto-destruir mensagens
            </label>
            <select
              id="message-ttl"
              value={messageTtl}
              onChange={(e) => setMessageTtl(e.target.value)}
              className="w-full rounded-xl bg-surface-800 border border-white/[0.07] px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-150 text-sm"
            >
              {TTL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400 bg-red-400/8 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-surface-700 transition-all duration-150"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bubble-own hover:opacity-90 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 shadow-glow-sm"
            >
              {loading ? 'Criando…' : ephemeral ? 'Criar Link' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

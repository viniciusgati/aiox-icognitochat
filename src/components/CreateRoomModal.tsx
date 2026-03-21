'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'

interface Room {
  id: number
  slug: string
  name: string
  created_at?: number
  is_ephemeral?: number
}

interface Props {
  onClose: () => void
  onCreated: (room: Room) => void
}

export default function CreateRoomModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [ephemeral, setEphemeral] = useState(false)
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
      const body = ephemeral
        ? { ephemeral: true }
        : { name }

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

      onCreated(data.room)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Nova Sala</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ephemeral toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={ephemeral}
                onChange={(e) => setEphemeral(e.target.checked)}
              />
              <div
                className={`w-10 h-6 rounded-full transition-colors ${
                  ephemeral ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
              />
              <div
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  ephemeral ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Sala Rápida</p>
              <p className="text-xs text-slate-500">Apagada quando todos saírem</p>
            </div>
          </label>

          {/* Name field — hidden for ephemeral rooms */}
          {!ephemeral && (
            <div>
              <label htmlFor="room-name" className="block text-sm font-medium text-slate-300 mb-1">
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
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Jogos, Música..."
              />
            </div>
          )}

          {ephemeral && (
            <p className="text-xs text-indigo-400 bg-indigo-900/30 rounded-lg px-3 py-2">
              🔗 Um link será gerado para você compartilhar. A sala desaparece quando todos saírem.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 font-semibold text-white transition-colors"
            >
              {loading ? 'Criando…' : ephemeral ? 'Criar Link' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

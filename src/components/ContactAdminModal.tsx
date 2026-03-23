'use client'

import { useState } from 'react'

const MAX_CHARS = 500

interface ContactAdminModalProps {
  onClose: () => void
  onSent?: () => void
}

export default function ContactAdminModal({ onClose, onSent }: ContactAdminModalProps) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const remaining = MAX_CHARS - message.length
  const canSend = message.trim().length > 0 && remaining >= 0

  async function handleSend() {
    if (!canSend) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contact-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao enviar mensagem')
        return
      }
      onSent?.()
      onClose()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">Falar com o Admin</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Envie uma mensagem ao administrador. Você receberá uma resposta via notificação.
        </p>

        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva sua dúvida ou problema…"
            rows={5}
            maxLength={MAX_CHARS}
            disabled={loading}
            autoFocus
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50"
          />
          <span
            className={`absolute bottom-3 right-3 text-xs ${
              remaining < 50 ? 'text-amber-400' : 'text-slate-600'
            }`}
          >
            {remaining}
          </span>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend || loading}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors"
          >
            {loading ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

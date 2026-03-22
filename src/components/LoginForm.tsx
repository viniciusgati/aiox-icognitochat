'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCallback = searchParams.get('callbackUrl')
  const safeRedirect = rawCallback?.startsWith('/chat') ? rawCallback : '/chat'
  const isExpired = searchParams.get('expired') === '1'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao fazer login')
        return
      }

      router.push(safeRedirect)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="username" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
          Usuário
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl bg-surface-800 border border-white/[0.07] px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-150 text-sm"
          placeholder="swift-3x9k"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">
          Senha
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-surface-800 border border-white/[0.07] px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-150 text-sm"
          placeholder="••••••••••"
        />
      </div>

      {isExpired && !error && (
        <p role="alert" className="text-xs text-amber-400 bg-amber-400/8 border border-amber-400/20 rounded-xl px-4 py-2.5">
          Sessão expirada, faça login novamente.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400 bg-red-400/8 border border-red-400/20 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bubble-own hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 font-semibold text-white transition-all duration-150 shadow-glow-sm text-sm"
      >
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

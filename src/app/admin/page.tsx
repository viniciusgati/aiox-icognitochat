'use client'

import { useState, useCallback } from 'react'

interface User {
  id: number
  username: string
  created_at: number
  last_seen_at: number | null
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('pt-BR')
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [newCreds, setNewCreds] = useState<{ username: string; password: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchUsers = useCallback(async (pwd: string) => {
    const res = await fetch('/api/auth/admin/users', {
      headers: { 'x-master-password': pwd },
    })
    if (!res.ok) return false
    const data = await res.json()
    setUsers(data.users)
    return true
  }, [])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setLoading(true)
    const ok = await fetchUsers(password)
    setLoading(false)
    if (!ok) {
      setAuthError('Senha incorreta ou muitas tentativas.')
      return
    }
    setAuthed(true)
  }

  async function handleCreate() {
    setError('')
    setNewCreds(null)
    const res = await fetch('/api/auth/admin/users', {
      method: 'POST',
      headers: { 'x-master-password': password },
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar usuário')
      return
    }
    setNewCreds({ username: data.username, password: data.password })
    await fetchUsers(password)
  }

  async function handleDelete(user: User) {
    if (!window.confirm(`Remover o usuário "${user.username}"? Esta ação não pode ser desfeita.`)) return
    setError('')
    const res = await fetch(`/api/auth/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'x-master-password': password },
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao remover usuário')
      return
    }
    await fetchUsers(password)
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-400">Admin</h1>
          <p className="mt-2 text-slate-400">IcognitoChat — Gerenciamento</p>
        </div>
        <form onSubmit={handleAuth} className="w-full max-w-sm space-y-4">
          <div>
            <label htmlFor="master-pwd" className="block text-sm font-medium text-slate-300 mb-1">
              Senha Mestra
            </label>
            <input
              id="master-pwd"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {authError && <p className="text-sm text-red-400">{authError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 font-semibold text-white transition-colors"
          >
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo-400">Admin — Usuários</h1>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          + Criar usuário
        </button>
      </div>

      {newCreds && (
        <div className="mb-6 rounded-lg bg-green-900/40 border border-green-700 p-4">
          <p className="text-sm font-semibold text-green-300 mb-2">Novo usuário criado — copie agora, não será exibido novamente:</p>
          <p className="font-mono text-sm text-slate-200">Usuário: <span className="text-white font-bold">{newCreds.username}</span></p>
          <p className="font-mono text-sm text-slate-200">Senha: <span className="text-white font-bold">{newCreds.password}</span></p>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Criado em</th>
              <th className="px-4 py-3">Último acesso</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {users.map((user) => (
              <tr key={user.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-200">{user.username}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(user.last_seen_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(user)}
                    className="text-xs rounded px-2 py-1 bg-red-900/50 hover:bg-red-700 text-red-300 hover:text-white transition-colors"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhum usuário cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: number
  username: string
  is_admin: number
  created_at: number
  last_seen_at: number | null
}

interface Room {
  id: number
  slug: string
  name: string
  is_ephemeral: number
  created_at: number
  message_ttl_seconds: number | null
  image_count: number
}

interface Stats {
  totalUsers: number
  totalRooms: number
  permanentRooms: number
  ephemeralRooms: number
  totalImages: number
  connectedSockets: number
  onlineUsers: number
  uptime: number
  dbSizeBytes: number
  imagesDirBytes: number
}

interface Settings {
  allow_room_creation: string
  admin_only_chat: string
}

type Tab = 'overview' | 'users' | 'rooms' | 'settings' | 'system'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('pt-BR')
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTtl(s: number | null): string {
  if (!s) return '—'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${s / 60}min`
  return `${s / 3600}h`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/admin/stats')
      if (!res.ok) { setError('Erro ao carregar stats'); return }
      setStats(await res.json())
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-slate-500 text-sm py-8 text-center">Carregando…</p>
  if (error) return <p className="text-red-400 text-sm py-8 text-center">{error}</p>
  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Usuários online" value={stats.onlineUsers} sub={`${stats.connectedSockets} sockets`} />
        <StatCard label="Total usuários" value={stats.totalUsers} />
        <StatCard label="Salas ativas" value={stats.totalRooms} sub={`${stats.permanentRooms} permanentes · ${stats.ephemeralRooms} rápidas`} />
        <StatCard label="Imagens" value={stats.totalImages} sub={formatBytes(stats.imagesDirBytes)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Uptime" value={formatUptime(stats.uptime)} />
        <StatCard label="Banco de dados" value={formatBytes(stats.dbSizeBytes)} />
        <StatCard label="Ambiente" value={process.env.NODE_ENV ?? 'production'} />
      </div>
      <div className="flex justify-end">
        <button onClick={load} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
          ↺ Atualizar
        </button>
      </div>
    </div>
  )
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [newCreds, setNewCreds] = useState<{ username: string; password: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/admin/users')
      if (!res.ok) { setError('Erro ao carregar usuários'); return }
      const data = await res.json()
      setUsers(data.users)
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setError('')
    setNewCreds(null)
    const res = await fetch('/api/auth/admin/users', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao criar usuário'); return }
    setNewCreds({ username: data.username, password: data.password })
    await load()
  }

  async function handleDelete(user: User) {
    if (!window.confirm(`Remover "${user.username}"? Esta ação não pode ser desfeita.`)) return
    setError('')
    const res = await fetch(`/api/auth/admin/users/${user.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao remover'); return }
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{users.length} usuário(s)</span>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          + Criar usuário
        </button>
      </div>

      {newCreds && (
        <div className="rounded-lg bg-green-900/40 border border-green-700 p-4">
          <p className="text-sm font-semibold text-green-300 mb-2">
            Novo usuário — copie agora, não será exibido novamente:
          </p>
          <p className="font-mono text-sm text-slate-200">
            Usuário: <span className="text-white font-bold">{newCreds.username}</span>
          </p>
          <p className="font-mono text-sm text-slate-200">
            Senha: <span className="text-white font-bold">{newCreds.password}</span>
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-500 text-sm py-8 text-center">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map((user) => (
                <tr key={user.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-200">{user.username}</td>
                  <td className="px-4 py-3">
                    {user.is_admin ? (
                      <span className="text-xs text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full">admin</span>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">usuário</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(user.last_seen_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {!user.is_admin && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-xs rounded px-2 py-1 bg-red-900/50 hover:bg-red-700 text-red-300 hover:text-white transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Nenhum usuário cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Rooms tab ────────────────────────────────────────────────────────────────

function RoomsTab() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/admin/rooms')
      if (!res.ok) { setError('Erro ao carregar salas'); return }
      const data = await res.json()
      setRooms(data.rooms)
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(room: Room) {
    const label = room.is_ephemeral ? `sala rápida "${room.slug}"` : `sala "${room.name}"`
    if (!window.confirm(`Remover a ${label}? Todos os participantes serão desconectados.`)) return
    setError('')
    const res = await fetch(`/api/auth/admin/rooms/${room.slug}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao remover sala'); return }
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{rooms.length} sala(s)</span>
        <button onClick={load} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
          ↺ Atualizar
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-500 text-sm py-8 text-center">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Nome / Slug</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">TTL</th>
                <th className="px-4 py-3">Imagens</th>
                <th className="px-4 py-3">Criada em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {rooms.map((room) => (
                <tr key={room.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-slate-200 font-medium">
                      {room.is_ephemeral ? room.slug : room.name}
                    </p>
                    <p className="text-slate-500 text-xs font-mono">{room.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {room.is_ephemeral ? (
                      <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">efêmera</span>
                    ) : (
                      <span className="text-xs text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full">permanente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatTtl(room.message_ttl_seconds)}</td>
                  <td className="px-4 py-3 text-slate-400">{room.image_count}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(room.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {room.slug !== 'general' && (
                      <button
                        onClick={() => handleDelete(room)}
                        className="text-xs rounded px-2 py-1 bg-red-900/50 hover:bg-red-700 text-red-300 hover:text-white transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Nenhuma sala encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/admin/settings')
      if (!res.ok) { setError('Erro ao carregar configurações'); return }
      setSettings(await res.json())
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/auth/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) { setError('Erro ao salvar'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500 text-sm py-8 text-center">Carregando…</p>
  if (!settings) return null

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-slate-400">
        Configurações globais aplicadas a todos os usuários não-admin.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">Configurações salvas.</p>}

      <div className="space-y-4">
        {/* allow_room_creation */}
        <label className="flex items-start gap-4 p-4 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-200">Permitir criação de salas</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Quando desativado, apenas o admin pode criar novas salas.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings.allow_room_creation === '1'}
            onClick={() => setSettings(s => s ? { ...s, allow_room_creation: s.allow_room_creation === '1' ? '0' : '1' } : s)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              settings.allow_room_creation === '1' ? 'bg-indigo-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                settings.allow_room_creation === '1' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        {/* admin_only_chat */}
        <label className="flex items-start gap-4 p-4 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-200">Modo suporte — usuários só falam com o admin</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Quando ativado, usuários não-admin só podem acessar a sala Geral.
              Impede conversas entre usuários.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings.admin_only_chat === '1'}
            onClick={() => setSettings(s => s ? { ...s, admin_only_chat: s.admin_only_chat === '1' ? '0' : '1' } : s)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              settings.admin_only_chat === '1' ? 'bg-indigo-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                settings.admin_only_chat === '1' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-6 py-2 text-sm font-semibold text-white transition-colors"
      >
        {saving ? 'Salvando…' : 'Salvar configurações'}
      </button>
    </div>
  )
}

// ─── System tab ───────────────────────────────────────────────────────────────

function SystemTab() {
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDestroy() {
    if (confirmText !== 'DESTRUIR') return
    setLoading(true)
    setError('')
    setResult('')
    try {
      const res = await fetch('/api/auth/admin/destroy', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      const d = data.destroyed
      setResult(`Destruído: ${d.users} usuários, ${d.rooms} salas, ${d.connections} conexões`)
      setConfirming(false)
      setConfirmText('')
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-6">
        <h2 className="text-base font-semibold text-red-400 mb-1">Zona de Perigo</h2>
        <p className="text-sm text-slate-400 mb-4">
          Apaga todos os usuários, salas e mensagens. Os clientes conectados serão
          desconectados. Esta ação é <strong className="text-red-400">irreversível</strong>.
        </p>

        {result && (
          <p className="text-sm text-green-400 bg-green-900/20 rounded-lg px-4 py-2 mb-4">{result}</p>
        )}
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Destruir todos os dados
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Digite <code className="text-red-400 font-mono">DESTRUIR</code> para confirmar:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              placeholder="DESTRUIR"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirming(false); setConfirmText('') }}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDestroy}
                disabled={confirmText !== 'DESTRUIR' || loading}
                className="flex-1 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                {loading ? 'Destruindo…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'users', label: 'Usuários' },
  { id: 'rooms', label: 'Salas' },
  { id: 'settings', label: 'Configurações' },
  { id: 'system', label: 'Sistema' },
]

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-indigo-400 font-bold text-lg">IcognitoChat</span>
          <span className="text-slate-500 text-sm">Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Sair
        </button>
      </header>

      <div className="border-b border-slate-700 px-6">
        <nav className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6 max-w-5xl">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'rooms' && <RoomsTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'system' && <SystemTab />}
      </div>
    </main>
  )
}

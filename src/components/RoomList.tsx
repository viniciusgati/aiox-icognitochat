'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CreateRoomModal from './CreateRoomModal'
import ContactAdminModal from './ContactAdminModal'
import { getUserColor, getUserInitials } from '@/lib/user-color'

interface Room {
  id: number
  slug: string
  name: string
  description?: string
  created_at?: number
}

function UserAvatar({ username }: { username: string }) {
  const color = getUserColor(username)
  const initials = getUserInitials(username)
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 select-none"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function RoomSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-xl bg-surface-800 border border-white/[0.04] animate-pulse" />
      ))}
    </div>
  )
}

export default function RoomList({
  username,
  isAdmin = false,
  allowContactAdmin = true,
}: {
  username: string
  isAdmin?: boolean
  allowContactAdmin?: boolean
}) {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactSentToast, setContactSentToast] = useState(false)
  const [redirectToast, setRedirectToast] = useState<string | null>(null)
  const [adminUnread, setAdminUnread] = useState(0)

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms')
      const data = await res.json()
      setRooms(data.rooms ?? [])
    } catch {
      // silently ignore network errors in list
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  useEffect(() => {
    if (!isAdmin) return
    async function fetchUnread() {
      try {
        const res = await fetch('/api/auth/admin/messages')
        if (res.ok) {
          const data = await res.json()
          setAdminUnread(data.unread ?? 0)
        }
      } catch { /* ignore */ }
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30_000)
    return () => clearInterval(interval)
  }, [isAdmin])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reason = params.get('reason')
    if (reason === 'not-found') {
      setRedirectToast('Sala não encontrada ou já foi encerrada')
      setTimeout(() => setRedirectToast(null), 5000)
      history.replaceState(null, '', window.location.pathname)
    } else if (reason === 'ephemeral-closed') {
      setRedirectToast('Esta sala efêmera foi encerrada')
      setTimeout(() => setRedirectToast(null), 5000)
      history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  function handleContactSent() {
    setContactSentToast(true)
    setTimeout(() => setContactSentToast(false), 3500)
  }

  async function handleSupportClick() {
    try {
      const res = await fetch('/api/sales-room')
      const data = await res.json()
      if (data.slug) router.push(`/chat/${data.slug}`)
    } catch {
      // fallback: open contact modal if sales room fails
      setShowContactModal(true)
    }
  }

  function handleRoomCreated(room: Room, maxParticipants?: number) {
    setRooms((prev) => [...prev, room])
    setShowModal(false)
    const url = maxParticipants ? `/chat/${room.slug}?max=${maxParticipants}` : `/chat/${room.slug}`
    router.push(url)
  }

  return (
    <>
      {/* Header */}
      <header className="glass sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-gradient font-bold text-base tracking-tight">IcognitoChat</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <UserAvatar username={username} />
            <span className="text-xs text-zinc-400 font-medium">{username}</span>
          </div>
          {isAdmin && (
            <a
              href="/admin"
              className="relative text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-900/30 font-medium"
            >
              ⚙️ Admin
              {adminUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                  {adminUnread > 99 ? '99+' : adminUnread}
                </span>
              )}
            </a>
          )}
          {!isAdmin && allowContactAdmin && (
            <button
              onClick={handleSupportClick}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded-lg hover:bg-surface-700"
              title="Falar com o Admin"
            >
              💬 Suporte
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-surface-700"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-5">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Section header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-zinc-100 font-semibold text-base">Salas</h1>
              <p className="text-xs text-zinc-600 mt-0.5">
                {loading ? '…' : `${rooms.length} disponíve${rooms.length === 1 ? 'l' : 'is'}`}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-xl bubble-own hover:opacity-90 px-3.5 py-2 text-sm font-semibold text-white transition-all duration-150 shadow-glow-sm"
            >
              + Nova Sala
            </button>
          </div>

          {loading ? (
            <RoomSkeleton />
          ) : (
            <ul className="space-y-1.5">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    onClick={() => router.push(`/chat/${room.slug}`)}
                    className="group w-full text-left rounded-xl bg-surface-800 hover:bg-surface-700 border border-white/[0.05] hover:border-white/[0.09] px-4 py-3 transition-all duration-150"
                  >
                    <div className="flex items-center gap-3">
                      {/* Channel icon */}
                      <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors font-mono text-sm">#</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-200 group-hover:text-zinc-100 font-medium text-sm transition-colors">
                          {room.name}
                        </span>
                        {room.description && (
                          <p className="text-xs text-zinc-600 truncate mt-0.5">{room.description}</p>
                        )}
                      </div>
                      {room.slug === 'general' && (
                        <span className="text-[10px] font-medium text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full shrink-0">
                          geral
                        </span>
                      )}
                      {/* Arrow */}
                      <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors text-xs">→</span>
                    </div>
                  </button>
                </li>
              ))}
              {rooms.length === 0 && (
                <li className="text-center text-zinc-600 text-sm py-12">
                  Nenhuma sala ainda. Crie a primeira!
                </li>
              )}
            </ul>
          )}
        </div>
      </main>

      {showModal && (
        <CreateRoomModal
          onClose={() => setShowModal(false)}
          onCreated={handleRoomCreated}
        />
      )}

      {showContactModal && (
        <ContactAdminModal
          onClose={() => setShowContactModal(false)}
          onSent={handleContactSent}
        />
      )}

      {contactSentToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-green-800 text-green-100 text-sm px-5 py-3 rounded-xl shadow-lg">
          Mensagem enviada ao admin ✓
        </div>
      )}

      {redirectToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 text-zinc-100 text-sm px-5 py-3 rounded-xl shadow-lg border border-white/10">
          {redirectToast}
        </div>
      )}
    </>
  )
}

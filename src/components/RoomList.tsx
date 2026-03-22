'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CreateRoomModal from './CreateRoomModal'

interface Room {
  id: number
  slug: string
  name: string
  description?: string
  created_at?: number
}

export default function RoomList({ username }: { username: string }) {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
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
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 font-bold text-lg">IcognitoChat</span>
          <span className="text-slate-500 text-sm">— {username}</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Sair
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto space-y-2">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-slate-200 font-semibold text-lg">Salas</h1>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors"
            >
              + Nova Sala
            </button>
          </div>

          {loading ? (
            <p className="text-slate-500 text-sm text-center py-8">Carregando salas…</p>
          ) : (
            <ul className="space-y-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    onClick={() => router.push(`/chat/${room.slug}`)}
                    className="w-full text-left rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">#</span>
                      <span className="text-slate-100 font-medium">{room.name}</span>
                      {room.slug === 'general' && (
                        <span className="ml-auto text-xs text-indigo-400 bg-indigo-900/40 px-2 py-0.5 rounded-full">
                          geral
                        </span>
                      )}
                    </div>
                    {room.description && (
                      <p className="mt-1 text-sm text-slate-500 ml-5">{room.description}</p>
                    )}
                  </button>
                </li>
              ))}
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
    </>
  )
}

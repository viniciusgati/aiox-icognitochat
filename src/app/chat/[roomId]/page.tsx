export const dynamic = 'force-dynamic'

import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sessionOptions, SessionData } from '@/lib/session'
import db, { getSetting, wasEphemeralRoom } from '@/lib/db'
import ChatWindow from '@/components/ChatWindow'

interface Props {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ max?: string; reason?: string }>
}

export default async function RoomPage({ params, searchParams }: Props) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.username) {
    redirect('/')
  }

  const { roomId } = await params
  const { max, reason } = await searchParams

  // admin_only_chat: non-admins can only access 'general' and their own vendas room (1.38)
  if (
    !session.isAdmin &&
    getSetting('admin_only_chat') === '1' &&
    roomId !== 'general' &&
    !roomId.startsWith('vendas-')
  ) {
    redirect('/chat/general?reason=restricted')
  }

  const maxParticipants = max ? parseInt(max, 10) : undefined

  const room = db
    .prepare('SELECT name, is_ephemeral, message_ttl_seconds, is_private, created_by FROM rooms WHERE slug = ?')
    .get(roomId) as {
      name: string
      is_ephemeral: number
      message_ttl_seconds: number | null
      is_private: number
      created_by: number | null
    } | undefined

  if (!room) {
    const reason = wasEphemeralRoom(roomId) ? 'ephemeral-closed' : 'not-found'
    redirect(`/chat?reason=${reason}`)
  }

  // Private room access: admin bypasses; non-admin only accesses their own private room
  if (room.is_private && !session.isAdmin && room.created_by !== session.userId) {
    redirect('/chat')
  }

  const restrictedRedirect = reason === 'restricted'

  return (
    <ChatWindow
      roomId={roomId}
      username={session.username}
      roomName={room.name}
      isEphemeral={room.is_ephemeral === 1}
      maxParticipants={maxParticipants}
      messageTtlSeconds={room.message_ttl_seconds ?? undefined}
      restrictedRedirect={restrictedRedirect}
    />
  )
}

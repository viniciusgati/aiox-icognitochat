export const dynamic = 'force-dynamic'

import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sessionOptions, SessionData } from '@/lib/session'
import db, { getSetting } from '@/lib/db'
import ChatWindow from '@/components/ChatWindow'

interface Props {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ max?: string }>
}

export default async function RoomPage({ params, searchParams }: Props) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.username) {
    redirect('/')
  }

  const { roomId } = await params
  const { max } = await searchParams

  // admin_only_chat: non-admins can only access the 'general' room
  if (!session.isAdmin && getSetting('admin_only_chat') === '1' && roomId !== 'general') {
    redirect('/chat/general')
  }
  const maxParticipants = max ? parseInt(max, 10) : undefined

  const room = db
    .prepare('SELECT name, is_ephemeral, message_ttl_seconds FROM rooms WHERE slug = ?')
    .get(roomId) as { name: string; is_ephemeral: number; message_ttl_seconds: number | null } | undefined

  if (!room) {
    redirect('/chat')
  }

  return (
    <ChatWindow
      roomId={roomId}
      username={session.username}
      roomName={room.name}
      isEphemeral={room.is_ephemeral === 1}
      maxParticipants={maxParticipants}
      messageTtlSeconds={room.message_ttl_seconds ?? undefined}
    />
  )
}

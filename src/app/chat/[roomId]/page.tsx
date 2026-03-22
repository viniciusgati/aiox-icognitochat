import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sessionOptions, SessionData } from '@/lib/session'
import db from '@/lib/db'
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
  const maxParticipants = max ? parseInt(max, 10) : undefined

  const room = db
    .prepare('SELECT name, is_ephemeral FROM rooms WHERE slug = ?')
    .get(roomId) as { name: string; is_ephemeral: number } | undefined

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
    />
  )
}

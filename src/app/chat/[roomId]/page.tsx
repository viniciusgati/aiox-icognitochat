import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sessionOptions, SessionData } from '@/lib/session'
import db from '@/lib/db'
import ChatWindow from '@/components/ChatWindow'

interface Props {
  params: Promise<{ roomId: string }>
}

export default async function RoomPage({ params }: Props) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.username) {
    redirect('/')
  }

  const { roomId } = await params

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
    />
  )
}

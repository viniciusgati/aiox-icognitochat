import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sessionOptions, SessionData } from '@/lib/session'
import RoomList from '@/components/RoomList'
import SessionGuard from '@/components/SessionGuard'

export default async function ChatPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.username) {
    redirect('/')
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100">
      <SessionGuard />
      <RoomList username={session.username} />
    </div>
  )
}

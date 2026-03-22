import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, SessionData } from '@/lib/session'
import db from '@/lib/db'

export async function GET(_req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.userId) {
    await session.destroy()
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(session.userId)

  if (!user) {
    await session.destroy()
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }

  return NextResponse.json({ username: session.username })
}

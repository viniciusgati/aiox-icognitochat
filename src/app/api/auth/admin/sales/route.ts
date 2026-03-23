import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sessionOptions, SessionData } from '@/lib/session'
import db from '@/lib/db'

interface SalesRoom {
  slug: string
  created_by: number
  username: string
  last_message: string | null
  last_activity: number | null
}

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rooms = db.prepare(`
    SELECT r.slug, r.created_by, u.username,
           (SELECT content FROM messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT created_at FROM messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_activity
    FROM rooms r
    JOIN users u ON u.id = r.created_by
    WHERE r.slug LIKE 'vendas-%'
    ORDER BY last_activity DESC
  `).all() as SalesRoom[]

  return NextResponse.json({ rooms })
}

import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sessionOptions, SessionData } from '@/lib/session'
import db from '@/lib/db'

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slug = `vendas-${session.userId}`

  const existing = db.prepare('SELECT slug FROM rooms WHERE slug = ?').get(slug)
  if (!existing) {
    db.prepare(`
      INSERT INTO rooms (slug, name, description, is_private, created_by)
      VALUES (?, ?, ?, 1, ?)
    `).run(slug, 'Vendas — Atendimento', 'Canal de vendas privado', session.userId)
  }

  return NextResponse.json({ slug })
}

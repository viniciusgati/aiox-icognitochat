import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

/** Admin: list all users with push subscription status */
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const rows = db
    .prepare(`
      SELECT u.id, u.username,
        CASE WHEN ps.id IS NOT NULL THEN 1 ELSE 0 END AS has_push
      FROM users u
      LEFT JOIN push_subscriptions ps ON ps.user_id = u.id
      ORDER BY u.username
    `)
    .all() as { id: number; username: string; has_push: number }[]

  return NextResponse.json({
    users: rows.map((r) => ({ ...r, has_push: r.has_push === 1 })),
  })
}

export async function POST(req: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: { endpoint?: string; p256dh?: string; auth?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { endpoint, p256dh, auth } = body
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'endpoint, p256dh e auth são obrigatórios' }, { status: 400 })
  }

  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh  = excluded.p256dh,
      auth    = excluded.auth,
      created_at = unixepoch()
  `).run(session.userId, endpoint, p256dh, auth)

  return NextResponse.json({ ok: true })
}
